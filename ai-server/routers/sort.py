from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from core.models import SortRequest, SortResponse
from services.sort_service import sort_places

router = APIRouter(prefix="/api", tags=["sort"])
limiter = Limiter(key_func=get_remote_address)

# 정렬: IP당 분당 30회 — 날짜별 정렬이므로 생성보다 자주 호출됨
@router.post("/sort", response_model=SortResponse)
@limiter.limit("30/minute")
async def sort(request: Request, req: SortRequest) -> SortResponse:
    return await sort_places(req)