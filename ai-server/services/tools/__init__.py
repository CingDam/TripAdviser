"""Agent loop가 호출 가능한 tool들 — Gemini function calling으로 노출된다.

각 tool은 (1) Gemini용 schema dict와 (2) 실행 함수를 export한다.
TOOL_SCHEMAS / TOOL_EXECUTORS를 agent_service에서 import해 사용.
"""
from services.tools.search_places import (
    SEARCH_PLACES_SCHEMA, execute_search_places,
)
from services.tools.get_weather import (
    GET_WEATHER_SCHEMA, execute_get_weather,
)
from services.tools.propose_add_places import (
    PROPOSE_ADD_PLACES_SCHEMA, execute_propose_add_places,
)
from services.tools.propose_replace_places import (
    PROPOSE_REPLACE_PLACES_SCHEMA, execute_propose_replace_places,
)

# Gemini function declarations — agent_service가 LLM 초기화 시 주입
TOOL_SCHEMAS = [
    SEARCH_PLACES_SCHEMA,
    GET_WEATHER_SCHEMA,
    PROPOSE_ADD_PLACES_SCHEMA,
    PROPOSE_REPLACE_PLACES_SCHEMA,
]

# tool name → 실행 함수 매핑
TOOL_EXECUTORS = {
    "search_places": execute_search_places,
    "get_weather": execute_get_weather,
    "propose_add_places": execute_propose_add_places,
    "propose_replace_places": execute_propose_replace_places,
}

# tool name → UI에 보여줄 한국어 thinking label
TOOL_LABELS = {
    "search_places": "장소 검색 중",
    "get_weather": "날씨 확인 중",
    "propose_add_places": "추가할 장소 정리 중",
    "propose_replace_places": "교체 제안 정리 중",
}
