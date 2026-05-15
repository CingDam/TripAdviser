import json
import logging
import re
import time

from fastapi import HTTPException
from langchain_google_genai import ChatGoogleGenerativeAI

from config import settings
from langchain_core.messages import AIMessage, HumanMessage

from core.models import (
    ChatAction, ChatRequest, ChatResponse,
    GenerateRequest, GenerateResponse,
)
from core.prompts import chat_prompt, generate_prompt

logger = logging.getLogger(__name__)

# 도우미용 — 자연스러운 대화체, 창의성 소폭 허용
_chat_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.gemini_api_key,
    temperature=0.7,
)

# 자동생성용 — 정확한 장소명 출력이 중요하므로 낮게 설정
_gen_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.gemini_api_key,
    temperature=0.4,
)


def _extract_json(text: str) -> dict:
    # Gemini가 가끔 ```json 코드블록으로 감싸 반환 — 양쪽 정리 후 파싱
    cleaned = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1)
    return json.loads(cleaned)


def _format_day_plans(day_plans: list) -> str:
    if not day_plans:
        return "아직 일정이 없습니다."
    lines: list[str] = []
    for dp in day_plans:
        place_str = ", ".join(dp.places) if dp.places else "장소 없음"
        lines.append(f"- {dp.date}: {place_str}")
    return "\n".join(lines)


def _build_history_messages(history: list) -> list:
    # 이전 대화를 LangChain 메시지 객체로 변환 — system 프롬프트 뒤에 삽입
    msgs = []
    for turn in history:
        if turn.role == "user":
            msgs.append(HumanMessage(content=turn.text[:500]))
        elif turn.role == "ai":
            msgs.append(AIMessage(content=turn.text[:1000]))
    return msgs


async def chat(req: ChatRequest) -> ChatResponse:
    logger.info("채팅 요청 — city:%s message_len:%d history:%d턴", req.city, len(req.message), len(req.history))

    # 히스토리를 포함한 메시지 목록 구성
    history_msgs = _build_history_messages(req.history)
    prompt_msgs = await chat_prompt.aformat_messages(
        city=req.city,
        day_plans=_format_day_plans(req.day_plans),
        message=req.message,
    )
    # system 메시지 뒤, 현재 human 메시지 앞에 이전 대화 삽입
    all_msgs = prompt_msgs[:-1] + history_msgs + prompt_msgs[-1:]

    started_at = time.monotonic()
    try:
        response = await _chat_llm.ainvoke(all_msgs)
        raw = response.content if hasattr(response, "content") else str(response)
    except Exception as e:
        logger.error("채팅 LLM 호출 실패 — city:%s error:%s", req.city, e)
        raise HTTPException(status_code=502, detail=f"AI 응답 실패: {e}")

    ms = int((time.monotonic() - started_at) * 1000)

    # 장소 추가 요청이면 JSON 형식으로 응답 — action 파싱 시도
    try:
        parsed = _extract_json(raw.strip())
        if isinstance(parsed, dict) and "reply" in parsed and "action" in parsed:
            places = parsed["action"].get("places", [])
            action = ChatAction(places=places[:8]) if places else None
            logger.info("채팅 action 응답 — city:%s places:%d개 llm:%dms", req.city, len(places), ms)
            return ChatResponse(reply=parsed["reply"], action=action)
    except (json.JSONDecodeError, Exception):
        # JSON 파싱 실패 = 일반 텍스트 응답 — 정상 경로
        pass

    logger.info("채팅 완료 — city:%s llm:%dms", req.city, ms)
    return ChatResponse(reply=raw.strip())


async def generate(req: GenerateRequest) -> GenerateResponse:
    logger.info("일정 자동생성 요청 — city:%s days:%d", req.city, len(req.dates))

    chain = generate_prompt | _gen_llm
    started_at = time.monotonic()
    try:
        response = await chain.ainvoke({
            "city": req.city,
            "dates": ", ".join(req.dates),
            "style": req.style or "제한 없음",
        })
        raw = response.content if hasattr(response, "content") else str(response)
        parsed = _extract_json(raw)
    except json.JSONDecodeError as e:
        logger.error("일정 생성 파싱 실패 — city:%s error:%s", req.city, e)
        raise HTTPException(status_code=502, detail=f"AI 응답 파싱 실패: {e}")
    except Exception as e:
        logger.error("일정 생성 LLM 호출 실패 — city:%s error:%s", req.city, e)
        raise HTTPException(status_code=502, detail=f"AI 응답 실패: {e}")

    ms = int((time.monotonic() - started_at) * 1000)

    # 가드레일 — 응답 구조 검증
    if not isinstance(parsed, dict) or "day_plans" not in parsed:
        raise HTTPException(status_code=502, detail="AI 응답 형식이 올바르지 않습니다")

    date_set = set(req.dates)
    returned_dates = {dp.get("date") for dp in parsed["day_plans"] if isinstance(dp, dict)}
    missing = date_set - returned_dates
    if missing:
        raise HTTPException(status_code=502, detail=f"AI 응답에서 누락된 날짜: {len(missing)}개")

    logger.info("일정 생성 완료 — city:%s days:%d llm:%dms", req.city, len(parsed["day_plans"]), ms)
    for dp in parsed["day_plans"]:
        logger.info("  날짜:%s city:%s 장소수:%d", dp.get("date"), dp.get("city", "없음"), len(dp.get("places", [])))

    try:
        return GenerateResponse(**parsed)
    except Exception as e:
        logger.error("일정 생성 응답 변환 실패 — error:%s", e)
        raise HTTPException(status_code=502, detail=f"AI 응답 변환 실패: {e}")
