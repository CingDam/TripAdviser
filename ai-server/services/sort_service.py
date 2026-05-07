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

# 동선상 시간대 위치 비율 — 거점 N개 중 어디에 부속을 끼워넣을지 결정
# 예: 거점 5개일 때 점심(0.4)은 2번째 거점 뒤, 저녁(0.85)은 4번째 거점 뒤에 배치
# 비율로 잡는 이유 — 거점 개수가 달라도 동선의 '오전/오후/저녁' 위치 의미가 보존됨
SLOT_POSITION_LUNCH = 0.4
SLOT_POSITION_CAFE = 0.65
SLOT_POSITION_DINNER = 0.9


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

    # 5. 부속을 시간대 슬롯 위치에 배치
    # 점심·저녁은 동선의 정해진 비율 위치에 끼워 '오전 관광 → 점심 → 오후 관광 → 저녁' 흐름 유도
    # 슬롯에 식당이 여러 후보면 그 위치 거점에서 가장 가까운 식당을 선택해 동선 비효율 최소화
    final_places: list[Place] = list(sorted_anchors)
    meal_pool = list(meals[:MAX_MEALS_PER_DAY])
    cafe_pool = list(cafes[:MAX_CAFES_PER_DAY])

    # 슬롯 → (위치 비율, 후보 풀) — 점심·저녁·카페 순으로 위치 비율 오름차순 처리해야
    # 삽입 시 인덱스가 어긋나지 않는다 (뒤쪽부터 삽입할수록 앞 인덱스 유지)
    slot_plan: list[tuple[float, list[Place]]] = []
    if meal_pool:
        slot_plan.append((SLOT_POSITION_LUNCH, meal_pool))  # 점심
    if cafe_pool:
        slot_plan.append((SLOT_POSITION_CAFE, cafe_pool))   # 오후 카페
    if len(meal_pool) >= 2:
        slot_plan.append((SLOT_POSITION_DINNER, meal_pool))  # 저녁 (meal_pool 두 번째)

    # 뒤쪽 슬롯부터 삽입 — 앞쪽 인덱스가 시프트되지 않도록
    for ratio, pool in sorted(slot_plan, key=lambda x: x[0], reverse=True):
        if not pool:
            continue
        anchor_count = len(sorted_anchors)
        target_anchor_idx = min(anchor_count - 1, max(0, int(round(ratio * anchor_count)) - 1))
        target_anchor = sorted_anchors[target_anchor_idx]

        # 슬롯 위치 거점에서 가장 가까운 후보를 선택
        sub = min(
            pool,
            key=lambda p: _haversine(
                target_anchor.location.lat, target_anchor.location.lng, p.location.lat, p.location.lng
            ),
        )
        pool.remove(sub)

        # final_places에서 해당 거점의 실제 인덱스 찾기 (이미 삽입된 부속으로 인덱스가 밀렸을 수 있음)
        actual_idx = final_places.index(target_anchor)
        final_places.insert(actual_idx + 1, sub)

    # 6. 슬롯 초과 식당·카페는 동선 끝에 부착 — 사용자에게 보존하되 거점 옆에 끼워넣지 않음
    final_places.extend(overflow_subs)

    # 7. 숙소를 시작/종점에 부착
    if start_lodging:
        final_places.insert(0, start_lodging)
    if end_lodging:
        final_places.append(end_lodging)

    return SortResponse(places=final_places)
