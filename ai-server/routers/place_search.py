from fastapi import APIRouter, Query
from core.models import PlaceSearchRequest, PlaceSearchResponse
from services.place_search_service import search_places

router = APIRouter(prefix="/api", tags=["place-search"])

@router.get("/place-search", response_model=PlaceSearchResponse)
async def place_search(
    query: str = Query(max_length=100),
    type: str = Query(max_length=20),
) -> PlaceSearchResponse:
    # Query 파라미터 검증은 PlaceSearchRequest validator에 위임
    req = PlaceSearchRequest(query=query, type=type)
    return await search_places(req.query, req.type)
