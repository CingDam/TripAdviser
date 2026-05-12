import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routers import sort, place_search
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

app = FastAPI(title="Travle Planner API")

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
    # AI 서버는 POST 정렬 요청만 받으므로 허용 메서드를 최소화
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.get("/")
def root():
    return {"message": "Travel Planner API", "status": "online"}

app.include_router(sort.router)
app.include_router(place_search.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
