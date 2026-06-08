from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str
    # NestJS → ai-server 내부 호출 인증용 — 외부에서 직접 호출 차단
    internal_secret: str = ""
    # Gemini 호출 타임아웃(초) — 응답 지연 시 사용자 대기 상한
    # chat: 빠른 응답 기대 / generate: 다날짜 생성으로 더 여유 / sort: 빠른 정렬
    llm_timeout_chat: int = 30
    llm_timeout_generate: int = 60
    # sort: 35 → 45초. Flash thinking 폭주로 35초 초과 시 DeadlineExceeded 발생하던 문제 완화
    llm_timeout_sort: int = 45
    # 정렬용 thinking 토큰 상한 — Gemini 2.5 Flash가 10개+ 장소 동선 최적화 시
    # thinking을 무제한 생성하다 타임아웃되던 것을 제한. 0(완전 끄기)은 동선 품질 저하 우려가 있어
    # 기본 추론은 유지하는 낮은 고정값 사용
    sort_thinking_budget: int = 512
    # Agent loop가 NestJS place-search tool을 호출할 때 사용 — 로컬 개발 폴백 포함
    nest_url: str = "http://localhost:3001"
    # 하이브리드 모델 — tool 호출(JSON 생성)은 빠르고 싼 Flash-Lite, 사용자가 읽는 최종 답변만 Pro
    # tool 판단은 "어떤 tool을 부를지" JSON 결정만이라 Lite로 충분 — 답변 품질은 Pro가 담당
    # Lite는 Flash 대비 입력 단가 약 1/3 — multi-step 대화에서 step마다 호출되므로 절감폭이 크다
    agent_tool_model: str = "gemini-2.5-flash-lite"
    agent_reply_model: str = "gemini-2.5-pro"
    # tool 판단용 thinking 토큰 상한 — Lite로 낮춘 만큼 화살표 다도시 매핑·귀국일 _skip 같은
    # 결정적 판단의 안정성을 위해 약간의 추론은 허용한다. sort와 동일하게 폭주만 차단하는 낮은 값
    agent_tool_thinking_budget: int = 512
    # Agent loop 한 대화당 tool 호출 step 상한 — 무한 루프·비용 폭주 방지
    # 5 → 8로 상향: 다중 도시 일정 분석(evaluate+search+propose) 시 step 부족 문제 해결
    agent_max_steps: int = 8

    class Config:
        env_file = ".env"

settings = Settings()