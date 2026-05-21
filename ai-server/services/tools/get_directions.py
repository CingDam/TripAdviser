"""두 장소 간 이동 시간·교통수단을 추정한다.

외부 지도 API를 호출하지 않고, 클라이언트가 ChatPlaceBrief로 함께 보낸 좌표를
Haversine 공식으로 직선 거리 계산 → 거리 구간별 평균 속도로 시간 추정.

장점: 무료·빠름·즉시 응답
한계: 실제 경로(우회·신호)는 반영하지 못함 — "대략적 추정"이라는 점을 응답에 명시할 것.
좌표가 없는 일정(구버전 클라이언트)에서는 같은 날 묶임 여부만 알려준다.
"""
import logging
import math

logger = logging.getLogger(__name__)

GET_DIRECTIONS_SCHEMA = {
    "name": "get_directions",
    "description": (
        "현재 일정에 추가된 두 장소 사이의 대략적인 이동 거리·시간과 추천 교통수단을 반환한다. "
        "사용자가 'A에서 B까지 얼마나 걸려?', '이 동선 가까워?' 같은 질문 시 사용한다. "
        "직선 거리 기반 추정이므로 정확한 경로 시간이 아님을 응답에 함께 언급할 것."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "from_name": {
                "type": "string",
                "description": "출발 장소명 — 현재 일정에 있는 장소여야 한다",
            },
            "to_name": {
                "type": "string",
                "description": "도착 장소명 — 현재 일정에 있는 장소여야 한다",
            },
        },
        "required": ["from_name", "to_name"],
    },
}


# 거리(km) → (추천 교통수단 라벨, 평균 시속 km/h)
# 도보 4km/h, 도보·대중교통 혼합 6, 대중교통(정류장 대기 포함) 20, 택시·도심 30
def _suggest_mode(distance_km: float) -> tuple[str, float]:
    if distance_km < 0.8:
        return ("도보", 4.0)
    if distance_km < 2.0:
        return ("도보 또는 대중교통", 6.0)
    if distance_km < 8.0:
        return ("대중교통(지하철·버스)", 20.0)
    return ("택시 또는 대중교통", 30.0)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 사이 대원거리(km). 지구 반지름 6371km."""
    r = 6371.0
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _coord_of(place: object) -> tuple[float, float] | None:
    """ChatPlaceBrief에서 좌표 추출 — str이거나 좌표가 None이면 None."""
    if isinstance(place, str):
        return None
    lat = getattr(place, "lat", None)
    lng = getattr(place, "lng", None)
    if lat is None or lng is None:
        return None
    return (float(lat), float(lng))


def _name_of(place: object) -> str:
    if isinstance(place, str):
        return place
    return getattr(place, "name", "") or ""


async def execute_get_directions(
    from_name: str,
    to_name: str,
    _day_plans: list | None = None,
    **_: object,
) -> dict:
    if not _day_plans:
        return {"error": "현재 일정 정보가 없어 이동 추정이 불가능합니다"}

    from_l = from_name.lower().strip()
    to_l = to_name.lower().strip()

    # 일정 전체를 한 번 훑으며 두 장소의 좌표·날짜를 모두 추출
    from_coord: tuple[float, float] | None = None
    to_coord: tuple[float, float] | None = None
    from_date: str | None = None
    to_date: str | None = None
    for dp in _day_plans:
        date = getattr(dp, "date", None)
        for p in getattr(dp, "places", []) or []:
            n = _name_of(p).lower().strip()
            if not n:
                continue
            if n == from_l and from_coord is None:
                from_coord = _coord_of(p)
                from_date = date
            if n == to_l and to_coord is None:
                to_coord = _coord_of(p)
                to_date = date

    if from_date is None or to_date is None:
        missing = []
        if from_date is None:
            missing.append(from_name)
        if to_date is None:
            missing.append(to_name)
        return {"error": f"현재 일정에서 찾을 수 없는 장소: {', '.join(missing)}"}

    # 좌표가 모두 있으면 Haversine 추정 — 직선거리+평균속도라 실제 경로보다 짧게 나옴
    if from_coord and to_coord:
        distance_km = _haversine_km(*from_coord, *to_coord)
        mode, speed_kmh = _suggest_mode(distance_km)
        # 도보·교통수단 평균속도 기준 분 — 직선 거리만 사용했으므로 +20% 보정으로 도로/우회 반영
        estimated_min = int((distance_km / speed_kmh) * 60 * 1.2)
        return {
            "from": from_name,
            "to": to_name,
            "same_day": from_date == to_date,
            "distance_km": round(distance_km, 2),
            "estimated_minutes": estimated_min,
            "suggested_mode": mode,
            "note": "직선거리 기반 추정 — 실제 경로는 Google Maps 확인 권장",
        }

    # 좌표가 없으면 같은 날 묶임 여부만 알려주는 fallback
    return {
        "from": from_name,
        "to": to_name,
        "same_day": from_date == to_date,
        "from_date": from_date,
        "to_date": to_date,
        "estimate": (
            "같은 날 일정에 묶여있어 가까운 거리일 가능성이 높습니다"
            if from_date == to_date
            else "서로 다른 날 일정입니다"
        ),
        "note": "장소 좌표 정보가 없어 거리 추정 불가",
    }
