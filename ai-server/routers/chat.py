from fastapi import APIRouter
from core.models import ChatRequest, ChatResponse, GenerateRequest, GenerateResponse
from services.chat_service import chat, generate

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest) -> ChatResponse:
    return await chat(req)

@router.post("/generate", response_model=GenerateResponse)
async def generate_endpoint(req: GenerateRequest) -> GenerateResponse:
    return await generate(req)
