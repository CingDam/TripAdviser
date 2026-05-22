from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str
    # NestJS → ai-server 내부 호출 인증용 — 외부에서 직접 호출 차단
    internal_secret: str = ""
    # Gemini 호출 타임아웃(초) — 응답 지연 시 사용자 대기 상한
    # chat: 빠른 응답 기대 / generate: 다날짜 생성으로 더 여유 / sort: 빠른 정렬
    llm_timeout_chat: int = 30
    llm_timeout_generate: int = 60
    llm_timeout_sort: int = 25
    # Agent loop가 NestJS place-search tool을 호출할 때 사용 — 로컬 개발 폴백 포함
    nest_url: str = "http://localhost:3001"
    # Agent loop 한 대화당 tool 호출 step 상한 — 무한 루프·비용 폭주 방지
    # 5 → 8로 상향: 다중 도시 일정 분석(evaluate+search+propose) 시 step 부족 문제 해결
    agent_max_steps: int = 8

    class Config:
        env_file = ".env"

settings = Settings()