"""특정 날짜의 예상 식음료·입장료 예산을 추정한다.

Gemini가 도시 물가를 직접 판단해 추정 — 하드코딩 단가 테이블 없음.
어떤 도시든 대응 가능하며, 장소 목록 맥락(고급 식당 vs 로컬 맛집 등)도 반영.
"""
import json
import logging
import re

from langchain_google_genai import ChatGoogleGenerativeAI
from config import settings

logger = logging.getLogger(__name__)

ESTIMATE_BUDGET_SCHEMA = {
    "name": "estimate_budget",
    "description": (
        "특정 날짜의 1인 기준 예상 예산(식사·카페·입장료)을 추정한다. "
        "사용자가 '하루 얼마 들어?', '예산 얼마 잡으면 돼?' 같은 질문 시 사용한다. "
        "AI가 도시 물가를 판단하므로 실제와 차이가 있을 수 있음을 응답에 함께 언급할 것."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": "예산을 추정할 날짜 YYYY-MM-DD",
            },
        },
        "required": ["date"],
    },
}

_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.gemini_api_key,
    temperature=0.1,
    request_timeout=20,
    max_retries=0,
)

def _extract_json(text: str) -> dict:
    cleaned = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        return json.loads(cleaned[start:end + 1])
    raise json.JSONDecodeError("JSON을 찾을 수 없음", cleaned, 0)


async def execute_estimate_budget(
    date: str,
    _day_plans: list | None = None,
    city: str | None = None,
    **_: object,
) -> dict:
    if not _day_plans:
        return {"error": "현재 일정 정보가 없어 예산 추정이 불가능합니다"}

    target = next((dp for dp in _day_plans if getattr(dp, "date", None) == date), None)
    if target is None:
        return {"error": f"'{date}' 날짜의 일정을 찾을 수 없습니다"}

    raw_places = getattr(target, "places", []) or []
    names = [
        p if isinstance(p, str) else (getattr(p, "name", "") or "")
        for p in raw_places
    ]
    names = [n for n in names if n]

    if not names:
        return {"date": date, "advice": "장소가 없어 예산 추정 불가"}

    places_text = "\n".join(f"- {n}" for n in names)
    prompt = (
        f"여행지: {city or '미설정'}\n"
        f"날짜: {date}\n"
        f"일정 장소 목록:\n{places_text}\n\n"
        f"위 장소들을 방문할 때 1인 기준 하루 예상 예산을 한국 원화(KRW)로 추정해라.\n"
        f"식사·카페·입장료·교통/잡비를 항목별로 계산하고, 해당 도시의 실제 물가 수준을 반영한다.\n"
        f"응답은 반드시 아래 JSON 형식으로만 반환한다 (설명 없이 순수 JSON):\n"
        f'{{"per_person_total_krw": 숫자, "breakdown": {{"식사": 숫자, "카페": 숫자, "입장료": 숫자, "교통·잡비": 숫자}}, "note": "한 줄 설명"}}'
    )

    try:
        response = await _llm.ainvoke(prompt)
        raw = response.content if hasattr(response, "content") else str(response)
        parsed = _extract_json(raw)
        return {"date": date, "city": city or "미설정", **parsed}
    except Exception as e:
        logger.error("예산 추정 LLM 실패 — date:%s error:%s", date, type(e).__name__)
        return {"error": "예산 추정에 실패했습니다. 잠시 후 다시 시도해주세요."}
