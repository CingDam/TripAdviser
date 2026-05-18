from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str
    # NestJS → ai-server 내부 호출 인증용 — 외부에서 직접 호출 차단
    internal_secret: str = ""

    class Config:
        env_file = ".env"

settings = Settings()