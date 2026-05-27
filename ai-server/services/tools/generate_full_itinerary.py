"""전체 일정 자동생성 제안 — AI는 직접 생성하지 않는다.

이 tool은 외부 호출 없이 입력(날짜별 도시·스타일)을 정리해 반환한다.
agent_service가 결과를 GenerateAction으로 변환 →
클라이언트가 [생성]/[취소] 버튼이 있는 확인 카드로 렌더하고,
[생성] 클릭 시 runFullGenerate(다일정 자동생성)를 실행한다.

기존 클라이언트의 정규식 의도 분류(detectFullGenerate)를 대체 —
LLM이 대화 문맥으로 자동생성 의도와 날짜별 도시를 직접 판단한다.
"""
import logging

logger = logging.getLogger(__name__)

GENERATE_FULL_ITINERARY_SCHEMA = {
    "name": "generate_full_itinerary",
    "description": (
        "사용자가 여행 전체 일정을 자동으로 짜달라고 요청할 때 호출한다. "
        "예: '3박4일 일정 짜줘', '처음부터 만들어줘', '교토 갔다가 오사카도 들르는 일정 좀'. "
        "AI는 직접 생성하지 않고 이 tool로 제안만 한다 — 사용자가 [생성] 버튼을 눌러야 실행된다. "
        "특정 날짜에 장소 몇 개만 추가하는 것은 propose_add_places를 쓰고, "
        "이 tool은 여러 날에 걸친 전체 일정 생성에만 사용한다. "
        "day_plans에 이미 장소가 채워진 날은 자동생성에서 건너뛰므로, 비어 있는 일정에 적합하다."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "day_cities": {
                "type": "object",
                "description": (
                    "날짜별 방문 도시 매핑. 키는 YYYY-MM-DD, 값은 도시명. "
                    "예: {\"2025-06-01\": \"오사카\", \"2025-06-02\": \"교토\"}. "
                    "사용자가 '첫날 오사카, 둘째날 교토'처럼 날짜별 도시를 말하면 day_plans의 date에 매핑해 채운다. "
                    "이동/귀국일처럼 장소를 만들지 않을 날은 값으로 \"_skip\"을 넣는다. "
                    "단일 도시 여행이거나 날짜별 도시가 불명확하면 비워둔다 — 그러면 destination 도시로 전체 생성한다."
                ),
                "additionalProperties": {"type": "string"},
            },
            "style": {
                "type": "string",
                "description": (
                    "여행 스타일 힌트 — 사용자가 언급한 취향을 그대로 전달. "
                    "예: '맛집 위주', '느긋하게 카페 투어', '아이와 함께'. 없으면 비워둔다."
                ),
            },
        },
        "required": [],
    },
}


async def execute_generate_full_itinerary(
    day_cities: dict | None = None,
    style: str = "",
    _day_plans: list | None = None,
    city: str = "",
    city_name: str = "",
    **_: object,  # agent_service가 주입하는 좌표 등 미사용 컨텍스트 흡수
) -> dict:
    """입력 검증 후 정리된 자동생성 제안을 반환. 외부 호출 없음."""
    # day_cities 검증 — 키는 YYYY-MM-DD, 값은 비어있지 않은 문자열만 통과
    normalized_cities: dict[str, str] = {}
    if isinstance(day_cities, dict):
        for date, c in day_cities.items():
            if not isinstance(date, str) or not isinstance(c, str):
                continue
            c = c.strip()
            if c:
                normalized_cities[date.strip()] = c

    return {
        "proposal_type": "generate",
        "city": city or city_name or "",
        "day_cities": normalized_cities,
        "style": style.strip() or None,
        # 채울 수 있는 빈 날 수 — 요약/디버깅용
        "day_count": len(_day_plans) if _day_plans else 0,
    }
