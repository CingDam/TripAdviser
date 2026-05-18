from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from core.models import ChatRequest, ChatResponse, GenerateRequest, GenerateResponse
from services.chat_service import chat, generate

router = APIRouter(prefix="/api", tags=["chat"])
limiter = Limiter(key_func=get_remote_address)

# 채팅: IP당 분당 20회 — 일반 대화 허용하되 과도 호출 차단
@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_endpoint(request: Request, req: ChatRequest) -> ChatResponse:
    return await chat(req)

# 자동생성: IP당 분당 5회 — Gemini 호출 비용이 크므로 엄격히 제한
@router.post("/generate", response_model=GenerateResponse)
@limiter.limit("5/minute")
async def generate_endpoint(request: Request, req: GenerateRequest) -> GenerateResponse:
    return await generate(req)
