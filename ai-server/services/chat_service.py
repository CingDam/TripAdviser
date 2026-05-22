import json
import logging
import re
import time
from typing import AsyncGenerator

from fastapi import HTTPException
from langchain_google_genai import ChatGoogleGenerativeAI

from config import settings
from langchain_core.messages import AIMessage, HumanMessage

from core.models import (
    ChatAction, ChatRequest, ChatResponse,
    GenerateRequest, GenerateResponse,
)
from core.prompts import chat_prompt, generate_prompt

# 허용 카테고리 집합 — 프롬프트 규칙과 동기화
ALLOWED_CATEGORIES = {"관광지", "식당", "카페", "쇼핑", "자연", "문화"}


def _validate_and_fix_day_plan(dp: dict, date: str) -> dict:
    """날짜별 장소 목록의 카테고리를 검증하고 허용값 외 항목을 제거한다."""
    places = dp.get("places", [])
    valid_places = []
    for place in places:
        cat = str(place.get("category", "")).strip()
        if cat not in ALLOWED_CATEGORIES:
            # 허용 카테고리가 아닌 장소는 기본값으로 교정 — 완전 제거 시 날짜 전체가 비어 오류 발생
            place = dict(place)
            place["category"] = "관광지"
        valid_places.append(place)

    # 식당 2곳·카페 1곳 최소 조건 확인 — 부족하면 경고 로그만 (LLM 재호출 비용 대신 허용)
    restaurant_count = sum(1 for p in valid_places if p.get("category") == "식당")
    cafe_count = sum(1 for p in valid_places if p.get("category") == "카페")
    if restaurant_count < 2 or cafe_count < 1:
        logger.warning(
            "날짜 %s 최소 조건 미달 — 식당:%d개(최소2) 카페:%d개(최소1)",
            date, restaurant_count, cafe_count,
        )

    dp = dict(dp)
    dp["places"] = valid_places
    return dp

logger = logging.getLogger(__name__)

# 도우미용 — 자연스러운 대화체, 창의성 소폭 허용
_chat_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.gemini_api_key,
    temperature=0.7,
    request_timeout=settings.llm_timeout_chat,
)

# 자동생성용 — 정확한 장소명 출력이 중요하므로 낮게 설정
_gen_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.gemini_api_key,
    temperature=0.4,
    request_timeout=settings.llm_timeout_generate,
)


def _extract_json(text: str) -> dict:
    """Gemini 응답에서 JSON을 추출한다.

    1순위: 코드블록(```json ... ```) 내부
    2순위: 응답 전체가 JSON
    3순위: 첫 번째 { ~ 마지막 } 사이를 잘라서 파싱 — 설명 텍스트가 섞인 응답 대응
    """
    cleaned = text.strip()

    # 코드블록 추출
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))

    # 전체가 JSON인 경우
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 설명 텍스트가 앞뒤에 섞인 경우 — 첫 { 부터 마지막 } 까지 잘라냄
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(cleaned[start:end + 1])

    raise json.JSONDecodeError("JSON을 찾을 수 없음", cleaned, 0)


def _format_nearby_context(nearby_places: list, category: str) -> str:
    """실시간 근처 장소 목록을 프롬프트 컨텍스트 문자열로 변환한다.

    nearby_places가 있으면 AI가 이 목록 중에서 추천하도록 유도 —
    Gemini 학습 데이터 대신 실제 영업 중인 장소 기반 추천 가능.
    """
    if not nearby_places:
        return ""
    lines = [f"## 현재 위치 주변 실제 {category} 목록 (Google Places 실시간 데이터)"]
    lines.append("아래 장소들은 현재 일정 위치 근처의 실제 영업 중인 장소입니다. 추천 시 이 목록을 우선 활용하세요.\n")
    for p in nearby_places:
        rating_str = f" ⭐{p.rating}" if p.rating else ""
        reviews_str = f" ({p.user_ratings_total}개 리뷰)" if p.user_ratings_total else ""
        price_map = {1: "저렴", 2: "보통", 3: "비쌈", 4: "매우 비쌈"}
        price_str = f" [{price_map.get(p.price_level, '')}]" if p.price_level else ""
        lines.append(f"- {p.name}{rating_str}{reviews_str}{price_str} — {p.formatted_address}")
    return "\n".join(lines) + "\n\n"


def _place_name(p: object) -> str:
    """ChatDayPlan.places 항목은 str 또는 ChatPlaceBrief — 이름만 추출."""
    if isinstance(p, str):
        return p
    return getattr(p, "name", "") or ""


def _format_day_plans(day_plans: list) -> str:
    if not day_plans:
        return "아직 일정이 없습니다."
    lines: list[str] = []
    for dp in day_plans:
        names = [_place_name(p) for p in dp.places]
        place_str = ", ".join(n for n in names if n) if names else "장소 없음"
        lines.append(f"- {dp.date}: {place_str}")
    return "\n".join(lines)


def _format_trip_duration(day_plans: list) -> str:
    # 날짜 수로 여행 기간 문자열 생성 — 예: "3일 (2025-06-01 ~ 2025-06-03)"
    if not day_plans:
        return "미정"
    n = len(day_plans)
    start = day_plans[0].date
    end = day_plans[-1].date
    nights = n - 1
    return f"{nights}박{n}일 ({start} ~ {end})"


def _collect_existing_places(day_plans: list) -> str:
    # 현재 일정의 모든 장소명을 수집 — 중복 추천 방지용
    places: list[str] = []
    for dp in day_plans:
        for p in dp.places:
            name = _place_name(p)
            if name:
                places.append(name)
    if not places:
        return "없음"
    return ", ".join(places)


def _build_history_messages(history: list) -> list:
    # 이전 대화를 LangChain 메시지 객체로 변환 — system 프롬프트 뒤에 삽입
    msgs = []
    for turn in history:
        if turn.role == "user":
            msgs.append(HumanMessage(content=turn.text[:500]))
        elif turn.role == "ai":
            msgs.append(AIMessage(content=turn.text[:1000]))
    return msgs


def _extract_conversation_city(history: list) -> str:
    """히스토리에서 가장 최근 context.city를 반환한다.

    사용자가 대화 중 다른 도시를 언급하면 해당 city를 우선 컨텍스트로 사용 —
    스토어의 현재 도시(city)가 교토여도 대화에서 오사카를 논했으면 오사카 기준 답변.
    """
    for turn in reversed(history):
        ctx = getattr(turn, "context", None)
        if ctx and getattr(ctx, "city", ""):
            return ctx.city
    return ""


def _normalize_action_places(places: list) -> list[dict[str, str | None]]:
    normalized: list[dict[str, str | None]] = []
    for place in places:
        if isinstance(place, str):
            name = place.strip()
            if name:
                normalized.append({"name": name, "category": None})
        elif isinstance(place, dict):
            name = str(place.get("name", "")).strip()
            category = place.get("category")
            if name:
                normalized.append({
                    "name": name,
                    "category": str(category).strip() if category else None,
                })
    return normalized


async def chat(req: ChatRequest) -> ChatResponse:
    conversation_city = _extract_conversation_city(req.history)
    logger.info("채팅 요청 — city:%s conv_city:%s message_len:%d history:%d턴",
                req.city, conversation_city or "없음", len(req.message), len(req.history))

    # 히스토리를 포함한 메시지 목록 구성
    history_msgs = _build_history_messages(req.history)
    prompt_msgs = await chat_prompt.aformat_messages(
        city=req.city,
        conversation_city=conversation_city if conversation_city else f"{req.city} (현재 여행지와 동일)",
        trip_duration=_format_trip_duration(req.day_plans),
        day_plans=_format_day_plans(req.day_plans),
        existing_places=_collect_existing_places(req.day_plans),
        nearby_context=_format_nearby_context(req.nearby_places, req.nearby_category),
        message=req.message,
    )
    # system 메시지 뒤, 현재 human 메시지 앞에 이전 대화 삽입
    all_msgs = prompt_msgs[:-1] + history_msgs + prompt_msgs[-1:]

    started_at = time.monotonic()
    try:
        response = await _chat_llm.ainvoke(all_msgs)
        raw = response.content if hasattr(response, "content") else str(response)
    except Exception as e:
        # 외부 API 에러 원문 노출 최소화 — 상세 원인은 서버 로그에만 기록
        logger.error("채팅 LLM 호출 실패 — city:%s error_type:%s", req.city, type(e).__name__)
        raise HTTPException(status_code=502, detail="AI 응답 실패")

    ms = int((time.monotonic() - started_at) * 1000)

    # 장소 추가 요청이면 JSON 형식으로 응답 — action 파싱 시도
    try:
        parsed = _extract_json(raw.strip())
        if isinstance(parsed, dict) and "reply" in parsed and "action" in parsed:
            reply = str(parsed.get("reply", "")).strip()
            if not reply:
                raise ValueError("reply 필드가 비어있음")

            raw_places = parsed["action"].get("places", []) if isinstance(parsed.get("action"), dict) else []
            normalized_places = _normalize_action_places(raw_places)

            # 허용 카테고리 외 항목 교정, 개수 상한 8개
            for p in normalized_places:
                if p.get("category") and p["category"] not in ALLOWED_CATEGORIES:
                    p["category"] = None
            normalized_places = normalized_places[:12]

            action = ChatAction(places=normalized_places) if normalized_places else None
            logger.info("채팅 action 응답 — city:%s places:%d개 llm:%dms", req.city, len(normalized_places), ms)
            return ChatResponse(reply=reply, action=action)
    except (json.JSONDecodeError, ValueError, Exception):
        # JSON 파싱 실패 또는 구조 이상 = 일반 텍스트 응답으로 fallback — 정상 경로
        pass

    logger.info("채팅 완료 — city:%s llm:%dms", req.city, ms)
    return ChatResponse(reply=raw.strip())


async def chat_stream(req: ChatRequest) -> AsyncGenerator[str, None]:
    """SSE 형식으로 채팅 응답을 토큰 단위로 스트리밍한다.

    일반 텍스트 응답: data: {"type":"token","text":"..."}
    JSON 액션 응답: 전체를 수집 후 파싱하여 data: {"type":"done","reply":"...","action":{...}}
    에러: data: {"type":"error","message":"..."}
    """
    conversation_city = _extract_conversation_city(req.history)
    logger.info("채팅 스트리밍 요청 — city:%s conv_city:%s history:%d턴",
                req.city, conversation_city or "없음", len(req.history))

    history_msgs = _build_history_messages(req.history)
    prompt_msgs = await chat_prompt.aformat_messages(
        city=req.city,
        conversation_city=conversation_city if conversation_city else f"{req.city} (현재 여행지와 동일)",
        trip_duration=_format_trip_duration(req.day_plans),
        day_plans=_format_day_plans(req.day_plans),
        existing_places=_collect_existing_places(req.day_plans),
        nearby_context=_format_nearby_context(req.nearby_places, req.nearby_category),
        message=req.message,
    )
    all_msgs = prompt_msgs[:-1] + history_msgs + prompt_msgs[-1:]

    collected = ""
    is_json_response = False  # { 로 시작하면 action 응답 — 완성 후 파싱
    started_at = time.monotonic()
    try:
        async for chunk in _chat_llm.astream(all_msgs):
            token = chunk.content if hasattr(chunk, "content") else str(chunk)
            if not isinstance(token, str):
                continue
            collected += token

            # 첫 토큰 수신 시 JSON 응답 여부 확정
            if not collected.lstrip():
                continue
            if not is_json_response and not collected.lstrip().startswith("{"):
                yield f"data: {json.dumps({'type': 'token', 'text': token}, ensure_ascii=False)}\n\n"
            elif collected.lstrip().startswith("{"):
                is_json_response = True

    except Exception as e:
        logger.error("채팅 스트리밍 LLM 실패 — city:%s error_type:%s", req.city, type(e).__name__)
        yield f"data: {json.dumps({'type': 'error', 'message': 'AI 응답 실패'}, ensure_ascii=False)}\n\n"
        return

    ms = int((time.monotonic() - started_at) * 1000)

    # 수집된 전체 응답으로 action JSON 파싱 시도
    if is_json_response:
        try:
            parsed = _extract_json(collected.strip())
            if isinstance(parsed, dict) and "reply" in parsed and "action" in parsed:
                reply = str(parsed.get("reply", "")).strip()
                raw_places = parsed["action"].get("places", []) if isinstance(parsed.get("action"), dict) else []
                normalized_places = _normalize_action_places(raw_places)
                for p in normalized_places:
                    if p.get("category") and p["category"] not in ALLOWED_CATEGORIES:
                        p["category"] = None
                normalized_places = normalized_places[:12]

                action = {"places": normalized_places} if normalized_places else None
                logger.info("채팅 스트리밍 action 응답 — city:%s places:%d개 llm:%dms", req.city, len(normalized_places), ms)
                # reply 텍스트를 token으로 먼저 방출해 사용자가 응답 텍스트를 바로 볼 수 있게 함
                yield f"data: {json.dumps({'type': 'token', 'text': reply}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'reply': reply, 'action': action}, ensure_ascii=False)}\n\n"
                return
        except (json.JSONDecodeError, ValueError):
            pass

    # JSON이 아닌 경우(또는 파싱 실패 fallback): 전체 텍스트를 done으로 마무리
    logger.info("채팅 스트리밍 완료 — city:%s llm:%dms", req.city, ms)
    yield f"data: {json.dumps({'type': 'done', 'reply': collected.strip()}, ensure_ascii=False)}\n\n"


def _format_day_cities(dates: list[str], day_cities: dict[str, str], default_city: str) -> str:
    """날짜별 도시 매핑을 프롬프트 텍스트로 변환한다.

    day_cities가 비어 있으면 모든 날짜를 default_city로 채운다.
    일부 날짜만 지정된 경우 나머지는 default_city 폴백.
    """
    lines = []
    for date in dates:
        city = day_cities.get(date, "").strip() or default_city
        lines.append(f"- {date}: {city}")
    return "\n".join(lines)


async def generate(req: GenerateRequest) -> GenerateResponse:
    logger.info("일정 자동생성 요청 — city:%s days:%d day_cities:%d개",
                req.city, len(req.dates), len(req.day_cities))

    day_cities_text = _format_day_cities(req.dates, req.day_cities, req.city)

    chain = generate_prompt | _gen_llm
    started_at = time.monotonic()
    try:
        response = await chain.ainvoke({
            "city": req.city,
            "dates": ", ".join(req.dates),
            "day_cities_text": day_cities_text,
            "style": req.style or "제한 없음",
        })
        raw = response.content if hasattr(response, "content") else str(response)
        parsed = _extract_json(raw)
    except json.JSONDecodeError:
        logger.error("일정 생성 파싱 실패 — city:%s", req.city)
        raise HTTPException(status_code=502, detail="AI 응답 파싱 실패")
    except Exception as e:
        logger.error("일정 생성 LLM 호출 실패 — city:%s error_type:%s", req.city, type(e).__name__)
        raise HTTPException(status_code=502, detail="AI 응답 실패")

    ms = int((time.monotonic() - started_at) * 1000)

    # 가드레일 — 응답 구조 검증
    if not isinstance(parsed, dict) or "day_plans" not in parsed:
        raise HTTPException(status_code=502, detail="AI 응답 형식이 올바르지 않습니다")

    date_set = set(req.dates)

    # extra date 제거 — 요청에 없는 날짜는 버림
    filtered_day_plans = [
        dp for dp in parsed["day_plans"]
        if isinstance(dp, dict) and dp.get("date") in date_set
    ]

    # 날짜별 빈 places 거부
    empty_dates = [dp["date"] for dp in filtered_day_plans if not dp.get("places")]
    if empty_dates:
        raise HTTPException(status_code=502, detail=f"AI 응답에서 장소가 없는 날짜: {len(empty_dates)}개")

    # 누락 날짜 검증
    returned_dates = {dp["date"] for dp in filtered_day_plans}
    missing = date_set - returned_dates
    if missing:
        raise HTTPException(status_code=502, detail=f"AI 응답에서 누락된 날짜: {len(missing)}개")

    # 날짜별 중복 장소명 제거 + 카테고리 검증
    cleaned_day_plans = []
    for dp in filtered_day_plans:
        # 중복 장소명 제거
        seen: set[str] = set()
        deduped = []
        for place in dp.get("places", []):
            key = str(place.get("name", "")).strip().lower()
            if key and key not in seen:
                seen.add(key)
                deduped.append(place)
        dp = dict(dp)
        dp["places"] = deduped
        # 카테고리 검증 + 식당·카페 최소 조건 확인
        dp = _validate_and_fix_day_plan(dp, dp["date"])
        cleaned_day_plans.append(dp)

    parsed["day_plans"] = cleaned_day_plans

    logger.info("일정 생성 완료 — city:%s days:%d llm:%dms", req.city, len(filtered_day_plans), ms)
    for dp in filtered_day_plans:
        logger.info("  날짜:%s city:%s 장소수:%d", dp.get("date"), dp.get("city", "없음"), len(dp.get("places", [])))

    try:
        return GenerateResponse(**parsed)
    except Exception as e:
        logger.error("일정 생성 응답 변환 실패 — error_type:%s", type(e).__name__)
        raise HTTPException(status_code=502, detail="AI 응답 변환 실패")
