"""기존 장소를 다른 장소로 교체 제안 — "비 오니까 실내로 바꿔줘" 같은 시나리오용.

propose_add_places와 동일하게 외부 호출 없이 입력 정리만 한다.
agent_service가 ChatAction(action_type="replace", remove_names=..., places=...)로 직렬화.
"""
import logging

logger = logging.getLogger(__name__)

ALLOWED_CATEGORIES = {"관광지", "식당", "카페", "쇼핑", "자연", "문화"}

PROPOSE_REPLACE_PLACES_SCHEMA = {
    "name": "propose_replace_places",
    "description": (
        "기존 일정의 장소를 다른 장소로 교체할 것을 제안한다. "
        "예: 비 예보 시 야외 장소를 실내로 변경. "
        "사용자가 [적용] 버튼을 눌러야 실제로 교체된다."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": (
                    "교체할 날짜 YYYY-MM-DD. "
                    "대화에서 날짜를 추론할 수 있으면 반드시 채워라 — "
                    "'2일차', '토요일', '첫날' 등은 day_plans의 date 값으로 변환. "
                    "완전히 알 수 없을 때만 비워둔다."
                ),
            },
            "remove_names": {
                "type": "array",
                "description": "현재 일정에서 제거할 장소명 목록",
                "items": {"type": "string"},
            },
            "add_places": {
                "type": "array",
                "description": "대신 추가할 장소 목록",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "category": {"type": "string", "enum": list(ALLOWED_CATEGORIES)},
                    },
                    "required": ["name", "category"],
                },
            },
            "place_city": {
                "type": "string",
                "description": (
                    "추가하는 장소들이 실제로 위치한 도시명. "
                    "일정 여행지와 다를 때 명시 — 예: 교토 일정에 오사카 장소 교체 시 '오사카'."
                ),
            },
        },
        "required": ["date", "remove_names", "add_places"],
    },
}


async def execute_propose_replace_places(
    date: str,
    remove_names: list,
    add_places: list,
    place_city: str = "",
    city: str = "",
    city_name: str = "",
    **_: object,
) -> dict:
    clean_remove = [str(n).strip() for n in remove_names if str(n).strip()][:10]
    normalized_add: list[dict] = []
    for p in add_places[:10]:
        if not isinstance(p, dict):
            continue
        name = str(p.get("name", "")).strip()
        category = p.get("category")
        if not name:
            continue
        if category and category not in ALLOWED_CATEGORIES:
            category = None
        normalized_add.append({"name": name, "category": category})

    return {
        "proposal_type": "replace",
        "date": date,
        "remove_names": clean_remove,
        "add_places": normalized_add,
        "remove_count": len(clean_remove),
        "add_count": len(normalized_add),
        # place_city: 교체할 장소의 실제 위치 도시 (일정 여행지와 다를 수 있음)
        "city": place_city or city or city_name or None,
    }
