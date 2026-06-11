import json
import logging
import re
import time
from langchain_google_genai import ChatGoogleGenerativeAI
from fastapi import HTTPException

from config import settings
from core.llm_errors import QUOTA_MESSAGE, is_quota_error
from core.models import SortRequest, SortResponse, SortedPlace, Place
from core.prompts import sort_prompt
from services.transit_service import estimate_transit_modes

logger = logging.getLogger(__name__)

# 허용 시간대 — LLM이 임의 레이블을 만들어내면 거부한다
VALID_TIME_SLOTS = {"오전", "점심", "오후", "저녁", "야간"}

# Gemini 2.5 Flash — 빠르고 저렴하면서 일정 정렬 정도는 충분히 처리 가능
# temperature=0.2 — 결정적 정렬에 가깝게 (창의적 답변 불필요)
# max_retries=0 — LangChain 자동 retry(tenacity) 비활성화
# 기본값은 지수 백오프로 2분+ 블로킹되므로 즉시 실패 후 클라이언트가 재시도하도록 함
# thinking_budget — 2.5 Flash의 thinking 폭주를 제한해 타임아웃 방지 (config 주석 참조)
_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.gemini_api_key,
    temperature=0.2,
    request_timeout=settings.llm_timeout_sort,
    max_retries=0,
    thinking_budget=settings.sort_thinking_budget,
)


def _serialize_places_for_prompt(places: list[Place]) -> str:
    # LLM이 판단에 필요한 최소 정보만 전달 — 토큰 절약 + 인젝션 표면 축소
    return json.dumps(
        [
            {
                "place_id": p.place_id,
                "name": p.name,
                "types": p.types,
                "lat": p.location.lat,
                "lng": p.location.lng,
            }
            for p in places
        ],
        ensure_ascii=False,
    )


def _extract_json(text: str) -> dict:
    """chat_service._extract_json과 동일한 3단계 파싱 — 코드블록·순수JSON·혼합텍스트 대응"""
    cleaned = text.strip()

    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(cleaned[start:end + 1])

    raise json.JSONDecodeError("JSON을 찾을 수 없음", cleaned, 0)


async def sort_places(req: SortRequest) -> SortResponse:
    logger.info("AI 정렬 요청 — date:%s places:%d개", req.date, len(req.places))

    # 1. LLM 호출 — 정렬과 시간대 부여를 모두 위임
    chain = sort_prompt | _llm
    started_at = time.monotonic()
    try:
        response = await chain.ainvoke({
            "date": req.date,
            "places": _serialize_places_for_prompt(req.places),
        })
        raw = response.content if hasattr(response, "content") else str(response)
        parsed = _extract_json(raw)
    except json.JSONDecodeError:
        logger.error("AI 응답 파싱 실패 — date:%s", req.date)
        raise HTTPException(status_code=502, detail="AI 응답 파싱 실패")
    except Exception as e:
        logger.error("AI 정렬 호출 실패 — date:%s error_type:%s detail:%s", req.date, type(e).__name__, e)
        detail = QUOTA_MESSAGE if is_quota_error(e) else "AI 정렬 호출 실패"
        raise HTTPException(status_code=502, detail=detail)
    llm_ms = int((time.monotonic() - started_at) * 1000)

    # 2. 가드레일 — LLM 응답이 입력과 정합한지 검증
    if not isinstance(parsed, dict) or "places" not in parsed or not isinstance(parsed["places"], list):
        raise HTTPException(status_code=502, detail="AI 응답 형식이 올바르지 않습니다")

    place_by_id: dict[str, Place] = {p.place_id: p for p in req.places}
    seen_ids: set[str] = set()
    sorted_places: list[SortedPlace] = []

    for item in parsed["places"]:
        if not isinstance(item, dict):
            raise HTTPException(status_code=502, detail="AI 응답 항목 형식 오류")
        pid = item.get("place_id")
        slot = item.get("time_slot")

        # LLM이 입력에 없는 place_id를 만들어냈거나, 중복 반환했을 때 거부
        if pid not in place_by_id:
            raise HTTPException(status_code=502, detail=f"AI가 알 수 없는 place_id 반환: {pid}")
        if pid in seen_ids:
            raise HTTPException(status_code=502, detail=f"AI 응답에 중복 place_id: {pid}")

        # 시간대 레이블이 허용 집합 밖이면 거부
        if slot not in VALID_TIME_SLOTS:
            raise HTTPException(status_code=502, detail=f"AI가 잘못된 time_slot 반환: {slot}")

        sorted_places.append(SortedPlace(place=place_by_id[pid], time_slot=slot))
        seen_ids.add(pid)

    # LLM이 일부 장소를 누락했으면 거부 — 사용자 입력 유실 방지
    missing = set(place_by_id.keys()) - seen_ids
    if missing:
        raise HTTPException(status_code=502, detail=f"AI 응답에서 누락된 장소: {len(missing)}개")

    logger.info("AI 정렬 완료 — date:%s places:%d개 llm:%dms", req.date, len(sorted_places), llm_ms)

    # 3. 이동수단 추정 — 정렬과 분리한 별도 경량 호출. 확정된 순서의 좌표만 넘겨 구간별 수단을 채운다
    # 실패해도 빈 맵이 와서 배지만 누락되고 정렬은 그대로 반환된다 (transit_service가 예외를 흡수)
    ordered = [sp.place for sp in sorted_places]
    modes = await estimate_transit_modes(ordered, use_car=req.use_car)
    for sp in sorted_places:
        sp.transit_mode = modes.get(sp.place.place_id)

    return SortResponse(places=sorted_places)
