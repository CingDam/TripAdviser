"""사용자 일정에 장소를 추가하는 제안 — AI는 직접 일정을 바꾸지 않는다.

이 tool은 외부 호출 없이 입력을 정리해 그대로 반환한다.
agent_service가 결과를 모아 최종 응답의 ChatAction으로 변환 →
클라이언트가 [적용]/[취소] 버튼이 있는 ActionCard로 렌더.
"""
import logging

logger = logging.getLogger(__name__)

ALLOWED_CATEGORIES = {"관광지", "식당", "카페", "쇼핑", "자연", "문화"}

PROPOSE_ADD_PLACES_SCHEMA = {
    "name": "propose_add_places",
    "description": (
        "사용자에게 장소 추가를 제안한다. AI는 일정을 직접 수정할 수 없고, "
        "이 tool로 제안만 한다. 사용자가 [적용] 버튼을 눌러야 일정에 반영된다. "
        "search_places로 실제 장소를 먼저 확인한 뒤 호출하는 것을 권장한다."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": (
                    "추가할 날짜 YYYY-MM-DD. "
                    "대화에서 날짜를 추론할 수 있으면 반드시 채워라 — "
                    "예: '2일차', '토요일', '첫날', '내일' 등의 표현이 있으면 해당 날짜로 변환. "
                    "day_plans 목록의 date 값을 참조해 매핑한다. "
                    "완전히 알 수 없을 때만 비워둔다."
                ),
            },
            "places": {
                "type": "array",
                "description": "추가할 장소 목록 (최대 10개)",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "실제 장소명"},
                        "category": {
                            "type": "string",
                            "description": "카테고리",
                            "enum": list(ALLOWED_CATEGORIES),
                        },
                    },
                    "required": ["name", "category"],
                },
            },
        },
        "required": ["places"],
    },
}


async def execute_propose_add_places(
    places: list,
    date: str = "",
    _day_plans: list | None = None,
    city: str = "",
    city_name: str = "",
    **_: object,  # agent_service가 주입하는 좌표 등 미사용 컨텍스트 흡수
) -> dict:
    """입력 검증 후 정리된 제안을 반환. 외부 호출 없음."""
    normalized: list[dict] = []
    for p in places[:10]:
        if not isinstance(p, dict):
            continue
        name = str(p.get("name", "")).strip()
        category = p.get("category")
        if not name:
            continue
        if category and category not in ALLOWED_CATEGORIES:
            category = None
        normalized.append({"name": name, "category": category})

    # date가 비어있으면 일정에서 가장 장소가 적은 날 자동 선택
    resolved_date = date or None
    if not resolved_date and _day_plans:
        min_count = None
        for dp in _day_plans:
            place_list = getattr(dp, "places", []) or []
            # str 또는 object — 이름만 추출해 카운트
            count = sum(1 for p in place_list if (p if isinstance(p, str) else getattr(p, "name", "")).strip())
            if min_count is None or count < min_count:
                min_count = count
                resolved_date = getattr(dp, "date", None)

    return {
        "proposal_type": "add",
        "date": resolved_date,
        "places": normalized,
        "count": len(normalized),
        # resolve 시 사용할 도시 — agent_service가 tool_context.city(conversation_city)를 주입
        "city": city or city_name or None,
    }
