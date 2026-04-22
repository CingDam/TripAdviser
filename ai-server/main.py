import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import sort
import uvicorn

app = FastAPI(title="Travle Planner API")

# CLIENT_URL 없으면 로컬 개발 폴백 — Railway 배포 시 환경변수로 주입
_client_url = os.getenv("CLIENT_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[_client_url],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(sort.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
