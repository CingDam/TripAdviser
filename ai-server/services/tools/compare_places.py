"""두 장소를 객관 지표(평점·리뷰 수·주소)로 비교한다.

"A vs B 어디가 좋아?" "A가 더 유명해?" 류 질문에 사용 — Gemini 학습 데이터 추측 대신
실제 Google Places 데이터로 비교 → 환각 방지.

내부적으로 NestJS의 /place-search/resolve를 두 번 호출.
"""
import asyncio
import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

COMPARE_PLACES_SCHEMA = {
    "name": "compare_places",
    "description": (
        "두 장소를 평점·리뷰 수로 비교한다. "
        "사용자가 'A와 B 어디가 좋아?' 같은 비교 질문을 했을 때 사용한다. "
        "결과는 두 장소의 객관 지표 + 어느 쪽이 더 인기 있는지 종합 판정 포함."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "name_a": {"type": "string", "description": "첫 번째 장소명"},
            "name_b": {"type": "string", "description": "두 번째 장소명"},
        },
        "required": ["name_a", "name_b"],
    },
}


async def execute_compare_places(
    name_a: str,
    name_b: str,
    city: str = "",
    **_: object,
) -> dict:
    """resolve 2회 병렬 호출 후 두 장소 데이터 비교."""
    a_task = _resolve(name_a, city)
    b_task = _resolve(name_b, city)
    a, b = await asyncio.gather(a_task, b_task)

    if not a and not b:
        return {"error": "두 장소 모두 찾을 수 없습니다"}
    if not a:
        return {"error": f"'{name_a}' 정보를 찾을 수 없습니다"}
    if not b:
        return {"error": f"'{name_b}' 정보를 찾을 수 없습니다"}

    # 평점×log(리뷰수+1) 가중치로 종합 점수 — 평점만 보면 표본 적은 곳이 유리
    import math
    score_a = (a.get("rating") or 0) * math.log((a.get("user_ratings_total") or 0) + 1)
    score_b = (b.get("rating") or 0) * math.log((b.get("user_ratings_total") or 0) + 1)
    winner = name_a if score_a > score_b else name_b if score_b > score_a else "비등"

    return {
        "a": {
            "name": a.get("name", name_a),
            "rating": a.get("rating"),
            "reviews": a.get("user_ratings_total"),
            "address": a.get("formatted_address"),
        },
        "b": {
            "name": b.get("name", name_b),
            "rating": b.get("rating"),
            "reviews": b.get("user_ratings_total"),
            "address": b.get("formatted_address"),
        },
        "winner_by_popularity": winner,
        "score_a": round(score_a, 2),
        "score_b": round(score_b, 2),
    }


async def _resolve(name: str, city: str) -> dict | None:
    url = f"{settings.nest_url}/api/place-search/resolve"
    payload = {"name": name, "city": city or ""}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, dict) else None
    except httpx.HTTPError as e:
        logger.warning("compare resolve 실패 — name:%s error:%s", name, type(e).__name__)
        return None
