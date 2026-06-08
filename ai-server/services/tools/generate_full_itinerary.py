"""전체 일정 자동생성 제안 — AI는 직접 생성하지 않는다.

이 tool은 외부 호출 없이 입력(날짜별 도시·스타일)을 정리해 반환한다.
agent_service가 결과를 GenerateAction으로 변환 →
클라이언트가 [생성]/[취소] 버튼이 있는 확인 카드로 렌더하고,
[생성] 클릭 시 runFullGenerate(다일정 자동생성)를 실행한다.

기존 클라이언트의 정규식 의도 분류(detectFullGenerate)를 대체 —
LLM이 대화 문맥으로 자동생성 의도와 날짜별 도시를 직접 판단한다.
"""
import logging
import re

logger = logging.getLogger(__name__)

# regenerate_dates 검증용 — 클라이언트 dayPlans의 date와 같은 YYYY-MM-DD 형식만 통과
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

GENERATE_FULL_ITINERARY_SCHEMA = {
    "name": "generate_full_itinerary",
    "description": (
        "사용자가 여행 전체 일정을 자동으로 짜달라고 요청할 때 호출한다. "
        "예: '3박4일 일정 짜줘', '처음부터 만들어줘', '교토 갔다가 오사카도 들르는 일정 좀'. "
        "AI는 직접 생성하지 않고 이 tool로 제안만 한다 — 사용자가 [생성] 버튼을 눌러야 실행된다. "
        "특정 날짜에 장소 몇 개만 추가하는 것은 propose_add_places를 쓰고, "
        "이 tool은 여러 날에 걸친 전체 일정 생성에만 사용한다. "
        "기본적으로 day_plans에 이미 장소가 채워진 날은 건너뛰고 비어 있는 날만 채운다. "
        "단, 사용자가 '첫날만 다시 짜줘', '2일차 새로 짜줘'처럼 이미 채워진 특정 날을 "
        "다시 짜달라고 하면 그 날짜들을 regenerate_dates에 담는다 — 그 날들은 기존 장소를 "
        "비우고 새로 채운다(공항·호텔은 유지)."
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
                    "**하루 안에서 도시가 바뀌면 화살표(→)로 연결한다** — 예: 사용자가 "
                    "'3일차는 교토에서 오후까지 보내고 오사카로 복귀해 저녁 먹고 쇼핑할거야'라고 하면 "
                    "그 날 값을 \"교토→오사카\"로 넣는다(오전·오후=교토, 저녁·쇼핑=오사카로 자동 배치된다). "
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
            "must_visit": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "사용자가 '꼭 가고 싶다'고 콕 집어 말한 구체적 장소·랜드마크·세부 지역. "
                    "예: '유니버설 스튜디오', '후시미 이나리', '에펠탑', '교토 기온 근처'. "
                    "여러 도시 일정이면 각 장소가 속한 도시 날짜에 자동 배치되므로 날짜는 신경 쓰지 않고 이름만 넣는다. "
                    "특정 장소 언급이 없으면 빈 배열로 둔다 — '맛집 위주' 같은 취향은 여기가 아니라 style에 넣는다."
                ),
            },
            "regenerate_dates": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "이미 장소가 채워져 있는데 사용자가 '다시 짜달라'고 콕 집은 날짜(YYYY-MM-DD). "
                    "예: '첫날만 다시 짜줘' → 그 첫날 날짜를 넣는다. 이 날들은 기존 일반 장소를 비우고 새로 채운다. "
                    "비어 있는 날을 처음 채우는 경우는 여기 넣지 않는다 — 그건 기본 동작이다. "
                    "사용자가 '몇 일차'로 말하면 day_plans의 date 순서로 환산해 실제 날짜를 넣는다."
                ),
            },
        },
        "required": [],
    },
}


async def execute_generate_full_itinerary(
    day_cities: dict | None = None,
    style: str = "",
    must_visit: list | None = None,
    regenerate_dates: list | None = None,
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

    # must_visit 검증 — 문자열 항목만, 공백 제거 후 빈 값·중복 제외. 프롬프트 폭주 방지로 최대 10개
    normalized_must: list[str] = []
    if isinstance(must_visit, list):
        for name in must_visit:
            if not isinstance(name, str):
                continue
            name = name.strip()
            if name and name not in normalized_must:
                normalized_must.append(name)
        normalized_must = normalized_must[:10]

    # regenerate_dates 검증 — YYYY-MM-DD 형식 문자열만, 공백 제거 후 중복 제외
    normalized_regen: list[str] = []
    if isinstance(regenerate_dates, list):
        for d in regenerate_dates:
            if not isinstance(d, str):
                continue
            d = d.strip()
            if _DATE_RE.match(d) and d not in normalized_regen:
                normalized_regen.append(d)

    return {
        "proposal_type": "generate",
        "city": city or city_name or "",
        "day_cities": normalized_cities,
        "style": style.strip() or None,
        "must_visit": normalized_must,
        "regenerate_dates": normalized_regen,
        # 채울 수 있는 빈 날 수 — 요약/디버깅용
        "day_count": len(_day_plans) if _day_plans else 0,
    }
