import httpx
from fastapi import HTTPException

from config import settings
from core.models import PlaceSearchResponse, PlaceSearchResult, Location

# Google Places Text Search (New) 엔드포인트
_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"

# 검색 타입별 includedType — 공항·호텔만 허용
_TYPE_MAP: dict[str, str] = {
    "airport": "airport",
    "hotel":   "lodging",
}

# 응답에서 필요한 필드만 요청 — 토큰 비용 절감
_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.types"


async def search_places(query: str, place_type: str) -> PlaceSearchResponse:
    included_type = _TYPE_MAP[place_type]

    payload = {
        "textQuery": query,
        "includedType": included_type,
        # 검색 결과 최대 5개 — 목록 UI에 충분하고 불필요한 데이터 수신 방지
        "pageSize": 5,
        "languageCode": "ko",
    }

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_maps_api_key,
        "X-Goog-FieldMask": _FIELD_MASK,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(_PLACES_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Google Places API 오류: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Google Places API 연결 실패: {e}")

    results: list[PlaceSearchResult] = []
    for p in data.get("places", []):
        loc = p.get("location", {})
        results.append(PlaceSearchResult(
            place_id=p.get("id", ""),
            name=p.get("displayName", {}).get("text", ""),
            formatted_address=p.get("formattedAddress", ""),
            location=Location(lat=loc.get("latitude", 0), lng=loc.get("longitude", 0)),
            types=p.get("types", []),
        ))

    return PlaceSearchResponse(results=results)
