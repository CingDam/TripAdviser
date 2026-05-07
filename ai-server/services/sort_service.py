import math
from core.models import SortRequest, SortResponse, Place

# Google Places type → 내부 카테고리 매핑
# 분류 의도: 거점(anchor)은 일정의 뼈대를 이루는 장소, 부속(sub)은 식사·휴식,
# 숙소(lodging)는 동선의 시작·종점으로 별도 처리한다.
GOOGLE_TYPE_TO_CATEGORY: dict[str, str] = {
    # 식사 — 점심/저녁 한 끼로 배치되는 부속
    "restaurant": "맛집", "food": "맛집", "meal_takeaway": "맛집", "meal_delivery": "맛집",
    # 카페·디저트 — 오후 휴식용 부속
    "cafe": "카페", "bakery": "카페",
    # 바·야간 — 저녁 이후 부속 (현재는 카페와 동일하게 sub로 처리)
    "bar": "바", "night_club": "바",
    # 관광·문화 — 거점
    "tourist_attraction": "관광지", "museum": "관광지", "art_gallery": "관광지",
    "amusement_park": "관광지", "aquarium": "관광지", "zoo": "관광지",
    "church": "관광지", "hindu_temple": "관광지", "mosque": "관광지", "synagogue": "관광지",
    # 자연 — 거점
    "park": "자연", "natural_feature": "자연",
    # 숙소 — 별도 (시작/종점)
    "lodging": "숙소",
    # 쇼핑 — 거점
    "shopping_mall": "쇼핑", "department_store": "쇼핑", "store": "쇼핑",
}

ANCHOR_CATEGORIES = {"관광지", "자연", "쇼핑"}
SUB_CATEGORIES = {"맛집", "카페", "바"}

# 식사·휴식 슬롯 — 하루 동선상 자연스러운 횟수
# 점심 1회 + 저녁 1회 = 식당 최대 2개, 카페·바는 오후 휴식 1회로 제한
MAX_MEALS_PER_DAY = 2
MAX_CAFES_PER_DAY = 1


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _get_category(place: Place) -> str:
    for t in place.types:
        if t in GOOGLE_TYPE_TO_CATEGORY:
            return GOOGLE_TYPE_TO_CATEGORY[t]
    # 매핑되지 않은 타입은 "기타" — 거점으로 간주해 NN에 포함시켜 유실 방지
    return "기타"


def _nearest_neighbor(places: list[Place], start: Place | None = None) -> list[Place]:
    if not places:
        return []
    remaining = list(places)

    if start:
        first = min(
            remaining,
            key=lambda p: _haversine(start.location.lat, start.location.lng, p.location.lat, p.location.lng),
        )
        remaining.remove(first)
        sorted_places = [first]
    else:
        sorted_places = [remaining.pop(0)]

    while remaining:
        current = sorted_places[-1]
        nearest = min(
            remaining,
            key=lambda p: _haversine(current.location.lat, current.location.lng, p.location.lat, p.location.lng),
        )
        sorted_places.append(nearest)
        remaining.remove(nearest)
    return sorted_places


async def sort_places(req: SortRequest) -> SortResponse:
    # 1. 카테고리 분류 — 숙소는 시작/종점, 거점은 뼈대, 부속은 거점 옆에 부착
    lodgings = [p for p in req.places if _get_category(p) == "숙소"]
    anchors = [p for p in req.places if _get_category(p) in ANCHOR_CATEGORIES or _get_category(p) == "기타"]
    meals = [p for p in req.places if _get_category(p) == "맛집"]
    cafes = [p for p in req.places if _get_category(p) in {"카페", "바"}]

    # 식사·카페 슬롯 분리 — 초과분은 동선에 끼워넣지 않고 일정 끝에 모아 둔다
    # (한 거점 옆에 식당 3개가 몰리는 문제를 방지)
    primary_subs = meals[:MAX_MEALS_PER_DAY] + cafes[:MAX_CAFES_PER_DAY]
    overflow_subs = meals[MAX_MEALS_PER_DAY:] + cafes[MAX_CAFES_PER_DAY:]
    subs = primary_subs

    # 2. 숙소 시작점 결정 — 숙소가 있으면 첫 숙소를 출발지로 사용
    # 숙소가 2개 이상이면 첫 번째는 시작, 마지막은 종점으로 분리한다
    start_lodging = lodgings[0] if lodgings else None
    end_lodging = lodgings[-1] if len(lodgings) >= 2 else None

    # 3. 거점이 없고 부속만 있는 경우 — 부속끼리 NN 정렬
    if not anchors and subs:
        sorted_subs = _nearest_neighbor(subs, start=start_lodging)
        result: list[Place] = []
        if start_lodging:
            result.append(start_lodging)
        result.extend(sorted_subs)
        result.extend(overflow_subs)
        if end_lodging:
            result.append(end_lodging)
        return SortResponse(places=result)

    # 4. 거점 NN 정렬 — 숙소가 있으면 숙소 기준 가까운 곳부터 시작
    sorted_anchors = _nearest_neighbor(anchors, start=start_lodging)

    # 5. 부속(식당·카페)을 가장 가까운 거점 뒤에 삽입 — '관광 후 식사' 동선 유도
    final_places: list[Place] = list(sorted_anchors)
    for sub in subs:
        closest_idx = 0
        min_dist = float("inf")
        for i, anchor in enumerate(final_places):
            # 이미 삽입된 부속은 건너뛰고 거점하고만 거리 비교
            if _get_category(anchor) in SUB_CATEGORIES:
                continue
            dist = _haversine(anchor.location.lat, anchor.location.lng, sub.location.lat, sub.location.lng)
            if dist < min_dist:
                min_dist = dist
                closest_idx = i
        final_places.insert(closest_idx + 1, sub)

    # 6. 슬롯 초과 식당·카페는 동선 끝에 부착 — 사용자에게 보존하되 거점 옆에 끼워넣지 않음
    final_places.extend(overflow_subs)

    # 7. 숙소를 시작/종점에 부착
    if start_lodging:
        final_places.insert(0, start_lodging)
    if end_lodging:
        final_places.append(end_lodging)

    return SortResponse(places=final_places)
