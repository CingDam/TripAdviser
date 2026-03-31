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
        # 이전 그룹 마지막 장소에서 가장 가까운 곳을 첫 번째로
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


def _is_single_group(groups: dict[str, list[str]]) -> bool:
    """LLM이 한 시간대에만 몰아넣은 경우 True (맛집만 있는 경우 등)"""
    non_empty = [slot for slot in TIME_SLOTS if groups.get(slot)]
    return len(non_empty) <= 1


async def sort_places(req: SortRequest) -> SortResponse:
    places_text = "\n".join([
        f"- place_id: {p.place_id}, 이름: {p.name}, 타입: {', '.join(p.types)}, 평점: {p.rating}"
        for p in req.places
    ])

    chain = sort_prompt | llm
    response = chain.invoke({
        "date": req.date,
        "places": places_text,
    })

    groups = _parse_groups(response.content)
    place_map = {p.place_id: p for p in req.places}

    # 같은 타입만 있어서 한 그룹에 몰린 경우 → 전체 NN으로 폴백
    if not groups or _is_single_group(groups):
        return SortResponse(places=_nearest_neighbor(req.places))

    # 시간대 순서대로 순회, 이전 그룹 마지막 장소를 다음 그룹 시작 기준으로 전달
    sorted_places: list[Place] = []
    assigned_ids: set[str] = set()
    last_place: Place | None = None

    for slot in TIME_SLOTS:
        ids = groups.get(slot, [])
        group_places = [place_map[pid] for pid in ids if pid in place_map]
        if not group_places:
            continue

        optimized = _nearest_neighbor(group_places, start=last_place)
        sorted_places.extend(optimized)
        assigned_ids.update(p.place_id for p in optimized)
        last_place = optimized[-1]

    # LLM이 누락한 장소는 마지막 위치 기준으로 뒤에 추가
    leftover = [p for p in req.places if p.place_id not in assigned_ids]
    if leftover:
        sorted_places.extend(_nearest_neighbor(leftover, start=last_place))

    return SortResponse(places=sorted_places or req.places)
