from fastapi import APIRouter
from core.models import SortRequest, SortResponse
from services.sort_service import sort_places

router = APIRouter(prefix="/api", tags=["sort"])

@router.post("/sort", response_model=SortResponse)
async def sort(req: SortRequest) -> SortResponse:
    return await sort_places(req)