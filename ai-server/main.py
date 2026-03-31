from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import sort
import uvicorn

app = FastAPI(title="Travle Planner API")

#Next.js 연결 허용
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(sort.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
