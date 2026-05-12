import json
import logging
import re
import time
from langchain_google_genai import ChatGoogleGenerativeAI
from fastapi import HTTPException

from config import settings
from core.models import SortRequest, SortResponse, SortedPlace, Place
from core.prompts import sort_prompt

logger = logging.getLogger(__name__)

# 허용 시간대 — LLM이 임의 레이블을 만들어내면 거부한다
VALID_TIME_SLOTS = {"오전", "점심", "오후", "저녁", "야간"}

# Gemini 2.5 Flash — 빠르고 저렴하면서 일정 정렬 정도는 충분히 처리 가능
# temperature=0.2 — 결정적 정렬에 가깝게 (창의적 답변 불필요)
_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.gemini_api_key,
    temperature=0.2,
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
    # Gemini가 가끔 ```json 코드블록으로 감싸 반환 — 양쪽 정리 후 파싱
    cleaned = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1)
    return json.loads(cleaned)


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
    except json.JSONDecodeError as e:
        logger.error("AI 응답 파싱 실패 — date:%s error:%s", req.date, e)
        raise HTTPException(status_code=502, detail=f"AI 응답 파싱 실패: {e}")
    except Exception as e:
        logger.error("AI 정렬 호출 실패 — date:%s error:%s", req.date, e)
        raise HTTPException(status_code=502, detail=f"AI 정렬 호출 실패: {e}")
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
    return SortResponse(places=sorted_places)
