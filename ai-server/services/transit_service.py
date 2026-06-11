import json
import logging
import re
import time
from langchain_google_genai import ChatGoogleGenerativeAI

from config import settings
from core.llm_errors import is_quota_error
from core.models import Place
from core.prompts import transit_prompt

logger = logging.getLogger(__name__)

# 허용 이동수단 — 첫 장소(None)는 별도 허용. 허용값 밖이면 None으로 보정해 배지만 누락시키고 정렬은 살린다
VALID_TRANSIT_MODES = {"도보", "전철", "버스", "기차", "차량"}

# Gemini 2.5 Flash — 이동수단 분류는 정렬보다 가벼운 작업이라 타임아웃·추론을 더 짧게 잡는다
# temperature=0.2 — 결정적 분류 (창의성 불필요)
# max_retries=0 — 지수 백오프 블로킹 방지 (sort와 동일 정책)
_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.gemini_api_key,
    temperature=0.2,
    request_timeout=settings.llm_timeout_transit,
    max_retries=0,
    thinking_budget=settings.transit_thinking_budget,
)


def _serialize_for_prompt(places: list[Place]) -> str:
    # 이동수단 판단에 필요한 최소 정보만 — 이름·types·좌표. 정렬용 메타는 불필요
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
    """sort_service._extract_json과 동일한 3단계 파싱 — 코드블록·순수JSON·혼합텍스트 대응"""
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


async def estimate_transit_modes(ordered_places: list[Place]) -> dict[str, str | None]:
    """정렬된 순서의 장소들에 대해 place_id → 이동수단 맵을 추정한다.

    이동수단은 보조 정보이므로 실패해도 정렬을 깨지 않는다 — 어떤 예외든 빈 맵을 반환해
    호출 측이 배지 없이 정렬 결과를 그대로 내보내게 한다 (배지 누락은 사소, 정렬 유실은 손해 큼).
    """
    if len(ordered_places) < 2:
        return {}  # 구간이 없으면 추정할 것이 없다

    chain = transit_prompt | _llm
    started_at = time.monotonic()
    try:
        response = await chain.ainvoke({"places": _serialize_for_prompt(ordered_places)})
        raw = response.content if hasattr(response, "content") else str(response)
        parsed = _extract_json(raw)
    except Exception as e:
        # quota는 운영 가시성을 위해 경고로, 그 외는 info — 어느 쪽이든 배지만 누락하고 정렬은 산다
        level = logging.WARNING if is_quota_error(e) else logging.INFO
        logger.log(level, "이동수단 추정 실패(배지 생략) — error_type:%s detail:%s", type(e).__name__, e)
        return {}

    if not isinstance(parsed, dict) or not isinstance(parsed.get("modes"), list):
        logger.info("이동수단 응답 형식 오류(배지 생략)")
        return {}

    valid_ids = {p.place_id for p in ordered_places}
    modes: dict[str, str | None] = {}
    for item in parsed["modes"]:
        if not isinstance(item, dict):
            continue
        pid = item.get("place_id")
        if pid not in valid_ids:
            continue
        mode = item.get("transit_mode")
        modes[pid] = mode if mode in VALID_TRANSIT_MODES else None

    llm_ms = int((time.monotonic() - started_at) * 1000)
    logger.info("이동수단 추정 완료 — places:%d개 llm:%dms", len(ordered_places), llm_ms)
    return modes
