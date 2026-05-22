"""실제 영업 중인 장소를 NestJS place-search/nearby 경유로 조회한다.

Gemini 학습 데이터 추측 대신 Google Places 실시간 결과를 AI가 사용 →
폐업한 가게·존재하지 않는 가게 환각 방지.

내부적으로 NestJS의 /place-search/nearby를 호출 — 현재 일정 중심 좌표(center) 컨텍스트로
주변 장소를 찾고, 카테고리 필터링까지 위임한다.
"""
import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

# Gemini function declaration
SEARCH_PLACES_SCHEMA = {
    "name": "search_places",
    "description": (
        "현재 사용자의 여행 일정 근처에서 실제로 영업 중인 장소를 검색한다. "
        "사용자가 식당·카페·관광지·쇼핑 등 카테고리를 원할 때 사용한다. "
        "최대 8개의 실제 장소 이름·주소·평점·리뷰수를 반환한다. "
        "주의: 카테고리는 반드시 enum 값 중 하나로 지정해야 한다."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "description": "찾고 싶은 장소의 카테고리",
                "enum": ["관광지", "식당", "카페", "쇼핑", "자연", "문화"],
            },
            "keyword": {
                "type": "string",
                "description": "추가 키워드 — 예: '라멘', '실내', '야경', '스시'. 비워두면 카테고리 전체 검색",
            },
        },
        "required": ["category"],
    },
}


async def execute_search_places(
    category: str,
    keyword: str = "",
    center_lat: float | None = None,
    center_lng: float | None = None,
    **_: object,  # agent_service가 주입하는 city·city_name 등 미사용 컨텍스트 흡수
) -> dict:
    """NestJS /place-search/nearby 호출.

    center_lat/lng는 LLM 인자엔 없고 agent_service가 컨텍스트에서 주입 —
    사용자 일정의 중심 좌표를 기준으로 검색.
    """
    if center_lat is None or center_lng is None:
        return {"places": [], "error": "현재 일정의 위치 정보가 없어 검색할 수 없습니다"}

    url = f"{settings.nest_url}/api/place-search/nearby"
    payload = {
        "lat": center_lat,
        "lng": center_lng,
        "category": category,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            raw = resp.json()
    except httpx.HTTPError as e:
        logger.warning("search_places 호출 실패 — category:%s error:%s", category, type(e).__name__)
        return {"places": [], "error": "검색 실패"}

    if not isinstance(raw, list):
        return {"places": []}

    # keyword가 있으면 이름/주소에 포함된 것만 필터 — Google 결과가 충분히 많으면 의미 있음
    if keyword:
        kw = keyword.lower()
        raw = [p for p in raw if kw in str(p.get("name", "")).lower()
               or kw in str(p.get("formatted_address", "")).lower()]

    places = []
    for item in raw[:8]:
        if not isinstance(item, dict):
            continue
        rating = item.get("rating")
        review_count = item.get("user_ratings_total")
        # LLM이 장소를 비교·선택할 때 참고할 수 있도록 평점·리뷰수·가격대를 포함
        entry: dict = {
            "name": item.get("name", ""),
            "address": item.get("formatted_address", ""),
        }
        if rating is not None:
            entry["rating"] = rating
        if review_count is not None:
            entry["review_count"] = review_count
        price = item.get("priceLevel")
        if price is not None:
            entry["price_level"] = price  # 0~4, LLM이 가격대 안내에 활용
        places.append(entry)

    return {"category": category, "keyword": keyword, "places": places}
