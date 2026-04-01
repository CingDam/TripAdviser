import json
import math
import re
from langchain_google_genai import ChatGoogleGenerativeAI
from core.models import SortRequest, SortResponse, Place
from core.prompts import sort_prompt
from config import settings

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.gemini_api_key,
    temperature=0,
    response_mime_type="application/json",
)

TIME_SLOTS = ["오전", "점심", "오후", "저녁"]

# placeTypes.json과 동일한 Google Places 타입 → 카테고리 매핑
GOOGLE_TYPE_TO_CATEGORY: dict[str, str] = {
    "restaurant":         "맛집",
    "food":               "맛집",
    "meal_takeaway":      "맛집",
    "meal_delivery":      "맛집",
    "cafe":               "카페",
    "bakery":             "카페",
    "coffee_shop":        "카페",
    "tourist_attraction": "관광지",
    "museum":             "관광지",
    "art_gallery":        "관광지",
    "amusement_park":     "관광지",
    "aquarium":           "관광지",
    "zoo":                "관광지",
    "park":               "자연",
    "natural_feature":    "자연",
    "shopping_mall":      "쇼핑",
    "store":              "쇼핑",
    "market":             "쇼핑",
    "lodging":            "숙소",
    "bar":                "바",
    "night_club":         "바",
}


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_neighbor(places: list[Place], start: Place | None = None) -> list[Place]:
    """Nearest Neighbor 알고리즘. start가 주어지면 그 장소에서 가장 가까운 곳부터 시작."""
    if not places:
        return []
    if len(places) == 1:
        return places

    remaining = list(places)

    if start:
        first = min(
            remaining,
            key=lambda p: _haversine(
                start.location.lat, start.location.lng,
                p.location.lat, p.location.lng,
            ),
        )
        remaining.remove(first)
        sorted_places = [first]
    else:
        sorted_places = [remaining.pop(0)]

    while remaining:
        current = sorted_places[-1]
        nearest = min(
            remaining,
            key=lambda p: _haversine(
                current.location.lat, current.location.lng,
                p.location.lat, p.location.lng,
            ),
        )
        sorted_places.append(nearest)
        remaining.remove(nearest)

    return sorted_places


def _get_category(place: Place) -> str:
    for t in place.types:
        if t in GOOGLE_TYPE_TO_CATEGORY:
            return GOOGLE_TYPE_TO_CATEGORY[t]
    return "기타"


def _parse_groups(raw_content: str) -> dict[str, list[str]]:
    content = (raw_content or "").strip()

    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    obj_match = re.search(r"\{[\s\S]*\}", content)
    if obj_match:
        try:
            parsed = json.loads(obj_match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass


    return {}


def _get_interleaved_categories(places: list[Place]) -> set[str]:
    """
    유저 입력 순서에서 같은 카테고리가 비연속적으로 등장하는(의도적으로 교차 배치된) 카테고리 집합.
    예: [관광지A, 식당B, 카페C, 관광지D] → 관광지는 0번, 3번 위치로 비연속 → {"관광지"}
    예: [관광지A, 관광지B, 식당C] → 관광지는 0,1번 연속 → 교차 아님 → {}
    """
    interleaved: set[str] = set()
    # 카테고리별 등장 인덱스 목록
    category_positions: dict[str, list[int]] = {}
    for i, p in enumerate(places):
        cat = _get_category(p)
        category_positions.setdefault(cat, []).append(i)

    for cat, positions in category_positions.items():
        if len(positions) < 2:
            continue
        # 연속 여부 확인: 인덱스 사이에 다른 카테고리가 끼어 있으면 비연속
        for j in range(len(positions) - 1):
            if positions[j + 1] - positions[j] > 1:  # 인덱스 차이 > 1이면 사이에 다른 타입 존재
                interleaved.add(cat)
                break

    return interleaved


def _is_valid_distribution(groups: dict[str, list[str]], places: list[Place]) -> bool:
    """
    LLM 결과가 유효한지 확인.
    - 유저가 의도적으로 교차 배치한 카테고리(비연속 등장)를 LLM이 한 슬롯에 몰아넣으면 False
    - 유저가 이미 연속으로 묶어 배치한 카테고리는 같은 슬롯에 있어도 OK
    """
    interleaved_cats = _get_interleaved_categories(places)
    if not interleaved_cats:
        return True  # 교차 배치 없으면 LLM 결과 그대로 사용

    category_ids: dict[str, list[str]] = {}
    for p in places:
        cat = _get_category(p)
        category_ids.setdefault(cat, []).append(p.place_id)

    # 교차 배치된 카테고리만 검사: 전부 같은 슬롯에 몰리면 비정상
    for cat in interleaved_cats:
        ids = category_ids.get(cat, [])
        for slot_ids in groups.values():
            if all(pid in slot_ids for pid in ids):
                return False

    return True


def _segment_sort_fallback(places: list[Place]) -> list[Place]:
    """
    LLM 결과가 부적절할 때 폴백.
    유저 입력 순서의 타입 패턴을 유지하면서 연속된 같은 타입 세그먼트 내에서만 NN 최적화.
    """
    if not places:
        return []

    segments: list[list[Place]] = []
    current_segment = [places[0]]
    current_cat = _get_category(places[0])

    for p in places[1:]:
        cat = _get_category(p)
        if cat == current_cat:
            current_segment.append(p)
        else:
            segments.append(current_segment)
            current_segment = [p]
            current_cat = cat
    segments.append(current_segment)

    sorted_places: list[Place] = []
    last_place: Place | None = None

    for segment in segments:
        optimized = _nearest_neighbor(segment, start=last_place)
        sorted_places.extend(optimized)
        last_place = optimized[-1]

    return sorted_places


def _pick_closest(pool: list[Place], anchor: Place) -> Place:
    """pool 중 anchor에서 가장 가까운 장소 반환."""
    return min(
        pool,
        key=lambda p: _haversine(
            anchor.location.lat, anchor.location.lng,
            p.location.lat, p.location.lng,
        ),
    )


# 식당(맛집) 슬롯 — LLM 배치 대신 직전 위치 기준 거리로 직접 선택
MEAL_SLOTS = {"점심", "저녁"}


async def sort_places(req: SortRequest) -> SortResponse:
    # 순서대로 번호를 붙여 유저의 배치 의도를 LLM에 전달
    places_text = "\n".join([
        f"{i + 1}. place_id: {p.place_id}, 이름: {p.name}, 타입: {', '.join(p.types)}, 평점: {p.rating}"
        for i, p in enumerate(req.places)
    ])

    chain = sort_prompt | llm
    response = chain.invoke({
        "date": req.date,
        "places": places_text,
    })

    groups = _parse_groups(response.content)
    place_map = {p.place_id: p for p in req.places}

    # LLM 응답이 없거나 교차 배치 패턴을 무시한 경우 → 세그먼트 폴백
    if not groups or not _is_valid_distribution(groups, req.places):
        return SortResponse(places=_segment_sort_fallback(req.places))

    # 맛집 전체를 슬롯과 무관하게 pool로 분리
    # 점심/저녁 슬롯에서 직전 위치 기준으로 가장 가까운 식당을 직접 선택
    meal_pool: list[Place] = [
        place_map[pid]
        for slot in TIME_SLOTS
        for pid in groups.get(slot, [])
        if pid in place_map and _get_category(place_map[pid]) == "맛집"
    ]

    sorted_places: list[Place] = []
    assigned_ids: set[str] = set()
    last_place: Place | None = None

    for slot in TIME_SLOTS:
        if slot in MEAL_SLOTS:
            # 식당 슬롯: 직전 위치에서 가장 가까운 식당 1개 선택
            if not meal_pool:
                continue
            chosen = _pick_closest(meal_pool, last_place) if last_place else meal_pool[0]
            meal_pool.remove(chosen)
            sorted_places.append(chosen)
            assigned_ids.add(chosen.place_id)
            last_place = chosen
        else:
            # 비식당 슬롯: LLM 배치대로 NN 최적화 (맛집이 잘못 배치된 경우 제외)
            group = [
                place_map[pid]
                for pid in groups.get(slot, [])
                if pid in place_map and _get_category(place_map[pid]) != "맛집"
            ]
            if not group:
                continue
            optimized = _nearest_neighbor(group, start=last_place)
            sorted_places.extend(optimized)
            assigned_ids.update(p.place_id for p in optimized)
            last_place = optimized[-1]

    # 식당이 3개 이상이라 남은 경우 마지막 위치 기준으로 뒤에 추가
    if meal_pool:
        optimized = _nearest_neighbor(meal_pool, start=last_place)
        sorted_places.extend(optimized)
        assigned_ids.update(p.place_id for p in optimized)
        last_place = optimized[-1] if optimized else last_place

    # LLM이 누락한 장소는 마지막 위치 기준으로 뒤에 추가
    leftover = [p for p in req.places if p.place_id not in assigned_ids]
    if leftover:
        sorted_places.extend(_nearest_neighbor(leftover, start=last_place))

    return SortResponse(places=sorted_places or req.places)
