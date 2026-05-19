from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from core.models import ChatRequest, ChatResponse, GenerateRequest, GenerateResponse
from services.agent_service import agent_stream
from services.chat_service import chat, generate

router = APIRouter(prefix="/api", tags=["chat"])
limiter = Limiter(key_func=get_remote_address)

# 채팅: IP당 분당 20회 — 일반 대화 허용하되 과도 호출 차단
@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_endpoint(request: Request, req: ChatRequest) -> ChatResponse:
    return await chat(req)

# 채팅 SSE 스트리밍: Agent loop — tool 호출(thinking) + 토큰 스트리밍
# 기존 chat_stream의 단순 텍스트 스트리밍을 대체. 클라이언트는 동일 엔드포인트 사용.
@router.post("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream_endpoint(request: Request, req: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        agent_stream(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx 버퍼링 비활성화 — SSE 즉시 전송
        },
    )

# 자동생성: IP당 분당 5회 — Gemini 호출 비용이 크므로 엄격히 제한
@router.post("/generate", response_model=GenerateResponse)
@limiter.limit("5/minute")
async def generate_endpoint(request: Request, req: GenerateRequest) -> GenerateResponse:
    return await generate(req)
