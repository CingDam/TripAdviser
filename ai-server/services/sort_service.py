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

# 카테고리 매핑
GOOGLE_TYPE_TO_CATEGORY: dict[str, str] = {
    "restaurant": "맛집", "food": "맛집", "cafe": "카페", "bakery": "카페",
    "tourist_attraction": "관광지", "museum": "관광지", "park": "자연",
    "lodging": "숙소", "shopping_mall": "쇼핑"
}

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
    return "기타"

def _nearest_neighbor(places: list[Place], start: Place | None = None) -> list[Place]:
    if not places: return []
    remaining = list(places)
    
    # 시작점이 없으면 첫 번째 장소 기준
    if start:
        first = min(remaining, key=lambda p: _haversine(start.location.lat, start.location.lng, p.location.lat, p.location.lng))
        remaining.remove(first)
        sorted_places = [first]
    else:
        sorted_places = [remaining.pop(0)]

    while remaining:
        current = sorted_places[-1]
        nearest = min(remaining, key=lambda p: _haversine(current.location.lat, current.location.lng, p.location.lat, p.location.lng))
        sorted_places.append(nearest)
        remaining.remove(nearest)
    return sorted_places

async def sort_places(req: SortRequest) -> SortResponse:
    # 1. 장소 분류 (거점 vs 부속)
    anchors = [p for p in req.places if _get_category(p) in ["관광지", "숙소", "자연", "쇼핑"]]
    subs = [p for p in req.places if _get_category(p) in ["맛집", "카페", "바"]]

    # 2. 거점(관광지)들만 먼저 거리순으로 정렬하여 뼈대 구축
    if not anchors and subs: # 관광지가 없고 식당만 있는 특수 상황
        return SortResponse(places=_nearest_neighbor(subs))
    
    sorted_itinerary = _nearest_neighbor(anchors)

    # 3. 부속 장소(식당/카페)를 가장 가까운 거점 옆에 자석처럼 붙임
    # 리스트를 복사해서 중간에 삽입하는 방식
    final_places = list(sorted_itinerary)
    for sub in subs:
        # 가장 가까운 거점의 인덱스 찾기
        closest_idx = 0
        min_dist = float('inf')
        for i, anchor in enumerate(final_places):
            # 이미 배치된 부속 장소는 계산에서 제외하고 '거점'하고만 비교
            if _get_category(anchor) not in ["관광지", "숙소", "자연", "쇼핑"]:
                continue
            dist = _haversine(anchor.location.lat, anchor.location.lng, sub.location.lat, sub.location.lng)
            if dist < min_dist:
                min_dist = dist
                closest_idx = i
        
        # 거점 바로 뒤에 삽입 (동선상 '관광 후 식사' 유도)
        final_places.insert(closest_idx + 1, sub)

    # 4. LLM에게 최종 순서에 대한 '시간대 레이블'만 부여 요청 (선택 사항)
    # 현재는 거리 기반 최적화가 우선이므로 바로 반환하거나, 
    # 필요시 final_places의 순서를 유지하며 시간대만 나누는 로직 추가 가능
    
    return SortResponse(places=final_places)