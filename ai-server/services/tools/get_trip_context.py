"""전체 여행 일정의 메타 분석 — 빈 날짜·과밀 날짜·전체 균형.

evaluate_day_balance가 단일 날짜에 집중한다면, 이 tool은 전체 여행을 한눈에 본다.
"내 일정 전체적으로 어때?" "어디부터 보완하면 좋을까?" 류 질문에 사용.
"""
import logging

logger = logging.getLogger(__name__)

GET_TRIP_CONTEXT_SCHEMA = {
    "name": "get_trip_context",
    "description": (
        "사용자의 전체 여행 일정을 한눈에 분석한다. "
        "빈 날짜·과밀 날짜·전체 장소 수·도시 분포를 반환한다. "
        "사용자가 '내 일정 어때?', '뭐 보완하면 좋을까?' 같이 전체 평가를 원할 때 사용."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}


async def execute_get_trip_context(
    _day_plans: list | None = None,
    city: str = "",
    **_: object,
) -> dict:
    if not _day_plans:
        return {
            "total_days": 0,
            "summary": "아직 일정이 없습니다. 날짜를 먼저 설정해주세요.",
        }

    total_days = len(_day_plans)
    empty_dates: list[str] = []
    light_dates: list[str] = []   # 1~2곳만 있는 날
    heavy_dates: list[str] = []   # 8곳 이상
    total_places = 0

    for dp in _day_plans:
        date = getattr(dp, "date", "")
        places = getattr(dp, "places", []) or []
        n = len(places)
        total_places += n
        if n == 0:
            empty_dates.append(date)
        elif n <= 2:
            light_dates.append(date)
        elif n >= 8:
            heavy_dates.append(date)

    avg = round(total_places / total_days, 1) if total_days > 0 else 0

    # 가장 보완이 시급한 날짜 추천 (빈 날짜 → light → heavy 재배치 순)
    next_action = None
    if empty_dates:
        next_action = f"비어있는 {empty_dates[0]} 날짜를 먼저 채우는 게 좋습니다"
    elif light_dates:
        next_action = f"{light_dates[0]}은 장소가 적어 보완을 고려해보세요"
    elif heavy_dates:
        next_action = f"{heavy_dates[0]}은 장소가 너무 많아 동선 정리가 필요할 수 있습니다"
    else:
        next_action = "전체적으로 균형 잡힌 일정입니다"

    return {
        "city": city,
        "total_days": total_days,
        "total_places": total_places,
        "avg_places_per_day": avg,
        "empty_dates": empty_dates,
        "light_dates": light_dates,
        "heavy_dates": heavy_dates,
        "next_action": next_action,
    }
