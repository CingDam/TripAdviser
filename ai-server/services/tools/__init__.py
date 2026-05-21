"""Agent loop가 호출 가능한 tool들 — Gemini function calling으로 노출된다.

각 tool은 (1) Gemini용 schema dict와 (2) 실행 함수를 export한다.
TOOL_SCHEMAS / TOOL_EXECUTORS를 agent_service에서 import해 사용.
"""
from services.tools.compare_places import (
    COMPARE_PLACES_SCHEMA, execute_compare_places,
)
from services.tools.evaluate_day_balance import (
    EVALUATE_DAY_BALANCE_SCHEMA, execute_evaluate_day_balance,
)
from services.tools.get_directions import (
    GET_DIRECTIONS_SCHEMA, execute_get_directions,
)
from services.tools.get_trip_context import (
    GET_TRIP_CONTEXT_SCHEMA, execute_get_trip_context,
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
from services.tools.search_places import (
    SEARCH_PLACES_SCHEMA, execute_search_places,
)

# Gemini function declarations — agent_service가 LLM 초기화 시 주입
TOOL_SCHEMAS = [
    SEARCH_PLACES_SCHEMA,
    GET_WEATHER_SCHEMA,
    GET_DIRECTIONS_SCHEMA,
    COMPARE_PLACES_SCHEMA,
    GET_TRIP_CONTEXT_SCHEMA,
    EVALUATE_DAY_BALANCE_SCHEMA,
    PROPOSE_ADD_PLACES_SCHEMA,
    PROPOSE_REPLACE_PLACES_SCHEMA,
]

# tool name → 실행 함수 매핑
TOOL_EXECUTORS = {
    "search_places": execute_search_places,
    "get_weather": execute_get_weather,
    "get_directions": execute_get_directions,
    "compare_places": execute_compare_places,
    "get_trip_context": execute_get_trip_context,
    "evaluate_day_balance": execute_evaluate_day_balance,
    "propose_add_places": execute_propose_add_places,
    "propose_replace_places": execute_propose_replace_places,
}

# tool name → UI에 보여줄 한국어 thinking label
TOOL_LABELS = {
    "search_places": "장소 검색 중",
    "get_weather": "날씨 확인 중",
    "get_directions": "이동 시간 추정 중",
    "compare_places": "두 장소 비교 중",
    "get_trip_context": "전체 일정 분석 중",
    "evaluate_day_balance": "하루 일정 평가 중",
    "propose_add_places": "추가할 장소 정리 중",
    "propose_replace_places": "교체 제안 정리 중",
}
