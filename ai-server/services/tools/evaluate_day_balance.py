"""특정 날짜의 일정 균형을 평가한다.

관광지/식당/카페 비율, 장소 총 개수, 시간대 분포(timeSlot)를 분석해
"하루 일정이 적절한지"에 대한 의견을 반환.

외부 호출 없음 — agent_service가 주입한 day_plans 컨텍스트만 사용.
"""
import logging

logger = logging.getLogger(__name__)

EVALUATE_DAY_BALANCE_SCHEMA = {
    "name": "evaluate_day_balance",
    "description": (
        "특정 날짜의 일정 균형을 평가한다. "
        "관광지·식당·카페 비율, 장소 수, 시간대 분포를 분석해 "
        "그 날 일정이 빡빡한지·여유로운지·균형이 맞는지 판정한다. "
        "사용자가 'Day 2 어때?', '오늘 일정 괜찮아?' 같은 질문 시 사용."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": "평가할 날짜 YYYY-MM-DD",
            },
        },
        "required": ["date"],
    },
}


# 이상적인 하루 일정 — generate_prompt 기준과 동일하게 유지
IDEAL_TOURIST_RANGE = (2, 3)
IDEAL_RESTAURANT = 2
IDEAL_CAFE = 1
MAX_TOTAL_NORMAL_PLACES = 8  # 이 이상이면 빡빡한 것으로 판단


async def execute_evaluate_day_balance(
    date: str,
    _day_plans: list | None = None,
    **_: object,
) -> dict:
    """_day_plans는 agent_service가 컨텍스트로 주입.

    agent_service는 ChatRequest.day_plans (ChatDayPlan: date, places=list[str])를 전달하는데
    카테고리 정보가 없다 → 장소명 키워드 기반 휴리스틱으로 분류.
    """
    if not _day_plans:
        return {"error": "현재 일정 정보가 없습니다"}

    target = next((dp for dp in _day_plans if getattr(dp, "date", None) == date), None)
    if target is None:
        return {"error": f"'{date}' 날짜의 일정을 찾을 수 없습니다"}

    raw_places = getattr(target, "places", []) or []
    # ChatPlaceBrief 또는 str 둘 다 허용 — 이름만 추출
    place_names = [
        p if isinstance(p, str) else (getattr(p, "name", "") or "")
        for p in raw_places
    ]
    place_names = [n for n in place_names if n]
    total = len(place_names)

    if total == 0:
        return {
            "date": date,
            "verdict": "비어있음",
            "total": 0,
            "advice": "장소를 추가해주세요. 관광지 2~3곳·식당 2곳·카페 1곳이 균형 잡힌 하루입니다.",
        }

    # 휴리스틱 분류 — 키워드 매칭
    counts = {"restaurant": 0, "cafe": 0, "other": 0}
    for name in place_names:
        cat = _classify_by_name(name)
        counts[cat] += 1

    issues: list[str] = []
    if total > MAX_TOTAL_NORMAL_PLACES:
        issues.append(f"장소 {total}곳으로 빡빡함 (권장 5~7곳)")
    if counts["restaurant"] < IDEAL_RESTAURANT:
        issues.append(f"식당 {counts['restaurant']}곳 (권장 {IDEAL_RESTAURANT}곳)")
    if counts["cafe"] < IDEAL_CAFE:
        issues.append(f"카페 {counts['cafe']}곳 (권장 {IDEAL_CAFE}곳)")
    if counts["other"] < IDEAL_TOURIST_RANGE[0]:
        issues.append(f"관광 요소 {counts['other']}곳 (권장 {IDEAL_TOURIST_RANGE[0]}~{IDEAL_TOURIST_RANGE[1]}곳)")

    if not issues:
        verdict = "균형 잡힘"
    elif total > MAX_TOTAL_NORMAL_PLACES:
        verdict = "빡빡함"
    elif total < 3:
        verdict = "여유롭거나 비어있음"
    else:
        verdict = "불균형"

    return {
        "date": date,
        "total": total,
        "restaurant_count": counts["restaurant"],
        "cafe_count": counts["cafe"],
        "tourist_count": counts["other"],
        "verdict": verdict,
        "issues": issues,
    }


_RESTAURANT_KEYWORDS = ("식당", "라멘", "초밥", "스시", "맛집", "레스토랑", "정식", "분식", "포차", "이자카야", "야끼니쿠")
_CAFE_KEYWORDS = ("카페", "커피", "디저트", "베이커리", "케이크", "도넛", "브런치", "파티세리", "스타벅스")


def _classify_by_name(name: str) -> str:
    lower = name.lower()
    if any(kw in lower or kw in name for kw in _CAFE_KEYWORDS):
        return "cafe"
    if any(kw in lower or kw in name for kw in _RESTAURANT_KEYWORDS):
        return "restaurant"
    return "other"
