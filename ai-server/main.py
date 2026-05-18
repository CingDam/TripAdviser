import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from routers import sort, chat
from config import settings
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# IP 기반 rate limiter — Gemini API 비용 보호 및 남용 방지
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Travle Planner API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def internal_auth_middleware(request: Request, call_next):
    # 헬스체크는 인증 제외
    if request.url.path == "/":
        return await call_next(request)

    # INTERNAL_SECRET이 설정된 경우에만 헤더 검증 — 미설정 시 개발 환경 폴백
    if settings.internal_secret:
        secret = request.headers.get("X-Internal-Secret", "")
        if secret != settings.internal_secret:
            return JSONResponse(status_code=403, content={"detail": "접근이 거부되었습니다"})

    return await call_next(request)


@app.middleware("http")
async def http_logging_middleware(request: Request, call_next):
    started_at = time.monotonic()
    response = await call_next(request)
    ms = int((time.monotonic() - started_at) * 1000)
    logging.getLogger("HTTP").info(
        "%s %s %s %dms", request.method, request.url.path, response.status_code, ms
    )
    return response

# CLIENT_URL 없으면 로컬 개발 폴백 — Railway 배포 시 환경변수로 주입
_client_url = os.getenv("CLIENT_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[_client_url],
    # POST: 정렬·채팅·생성 / GET: 헬스체크
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.get("/")
def root():
    return {"message": "Travel Planner API", "status": "online"}

app.include_router(sort.router)
app.include_router(chat.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
