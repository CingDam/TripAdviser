"""LLM 호출 예외 처리 공용 유틸.

Gemini(LangChain ChatGoogleGenerativeAI) 호출이 실패할 때, 로그에는 원인을
그대로 남기고 사용자에게는 사유별로 다른 안내를 주기 위한 헬퍼.

이전에는 모든 예외를 "AI 응답 실패" 한 줄로 삼키고 error_type만 로깅해,
크레딧 소진(429 RESOURCE_EXHAUSTED) 같은 명확한 사유가 보이지 않아
원인 파악에 한참 걸렸다. 본문(str(e))을 남겨 재발 시 즉시 식별한다.
"""


def is_quota_error(e: Exception) -> bool:
    """429 / 할당량·크레딧 소진(RESOURCE_EXHAUSTED) 계열인지 판별.

    LangChain이 google.genai 예외를 감싸는 방식이 버전마다 달라
    code 속성·클래스명·메시지 본문 중 하나라도 429 신호면 True로 본다.
    """
    if getattr(e, "code", None) == 429 or getattr(e, "status_code", None) == 429:
        return True
    text = f"{type(e).__name__} {e}".lower()
    return "429" in text or "resource_exhausted" in text or "resourceexhausted" in text


# 사용자 노출 메시지 — API 에러 원문은 노출하지 않는다
QUOTA_MESSAGE = "지금 AI 사용량이 많아 잠시 응답이 어려워요. 잠시 후 다시 시도해 주세요."
GENERIC_MESSAGE = "AI 응답 실패"


def user_message(e: Exception) -> str:
    """예외 종류에 맞는 사용자 노출 메시지를 고른다."""
    return QUOTA_MESSAGE if is_quota_error(e) else GENERIC_MESSAGE
