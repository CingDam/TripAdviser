"""특정 날짜의 예상 식음료·입장료 예산을 추정한다.

외부 호출 없음 — agent_service가 주입한 _day_plans 컨텍스트의 장소명 휴리스틱과
nearby_places의 price_level(0~4) 정보가 있으면 함께 활용.

한계: 클라이언트가 price_level을 ChatPlaceBrief에 넣어 보내지 않으므로,
현재는 도시별 평균 단가 테이블과 카테고리 분류만으로 추정.
"실제와 다를 수 있다"는 점을 응답에 명시할 것.
"""
import logging

logger = logging.getLogger(__name__)

ESTIMATE_BUDGET_SCHEMA = {
    "name": "estimate_budget",
    "description": (
        "특정 날짜의 1인 기준 예상 예산(식사·카페·입장료)을 추정한다. "
        "사용자가 '하루 얼마 들어?', '예산 얼마 잡으면 돼?' 같은 질문 시 사용한다. "
        "휴리스틱 추정이므로 실제와 차이가 있을 수 있음을 응답에 함께 언급할 것."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": "예산을 추정할 날짜 YYYY-MM-DD",
            },
        },
        "required": ["date"],
    },
}


# 도시별 1인 평균 단가 (원) — 식당 1끼·카페 1잔·관광지 1곳 입장료 기준
# 환율·물가는 2026년 기준 대략치. 정확하지 않아도 비교 감각용으로 충분
_CITY_PRICES: dict[str, dict[str, int]] = {
    "서울": {"meal": 15000, "cafe": 6000, "entry": 8000},
    "부산": {"meal": 13000, "cafe": 5500, "entry": 7000},
    "제주": {"meal": 18000, "cafe": 7000, "entry": 12000},
    "도쿄": {"meal": 18000, "cafe": 7000, "entry": 10000},
    "오사카": {"meal": 16000, "cafe": 6500, "entry": 9000},
    "교토": {"meal": 17000, "cafe": 7000, "entry": 8000},
    "후쿠오카": {"meal": 14000, "cafe": 6000, "entry": 7000},
    "방콕": {"meal": 8000, "cafe": 4500, "entry": 6000},
    "싱가포르": {"meal": 22000, "cafe": 9000, "entry": 15000},
    "발리": {"meal": 10000, "cafe": 5000, "entry": 8000},
    "다낭": {"meal": 8000, "cafe": 4000, "entry": 5000},
    "파리": {"meal": 28000, "cafe": 8000, "entry": 18000},
    "로마": {"meal": 25000, "cafe": 6000, "entry": 18000},
    "바르셀로나": {"meal": 22000, "cafe": 6000, "entry": 15000},
    "런던": {"meal": 30000, "cafe": 9000, "entry": 25000},
    "뉴욕": {"meal": 35000, "cafe": 10000, "entry": 30000},
}

# 도시명 매칭 실패 시 사용하는 글로벌 폴백 — 중간 물가 기준
_DEFAULT_PRICES = {"meal": 18000, "cafe": 7000, "entry": 10000}


_RESTAURANT_KEYWORDS = (
    "식당", "라멘", "초밥", "스시", "맛집", "레스토랑", "정식", "분식", "포차", "이자카야", "야끼니쿠", "다이닝",
    "ramen", "sushi", "restaurant", "kitchen", "grill", "izakaya", "yakitori", "tonkatsu",
    "tempura", "udon", "soba", "donburi", "yakiniku", "kaiseki", "dim sum", "pho", "bistro",
)
_CAFE_KEYWORDS = (
    "카페", "커피", "디저트", "베이커리", "케이크", "도넛", "브런치", "파티세리", "스타벅스", "티룸",
    "cafe", "coffee", "bakery", "patisserie", "dessert", "arabica", "streamer", "saturdays",
)


def _classify(name: str) -> str:
    lower = name.lower()
    if any(kw in lower for kw in _CAFE_KEYWORDS):
        return "cafe"
    if any(kw in lower for kw in _RESTAURANT_KEYWORDS):
        return "restaurant"
    return "tourist"


def _price_table(city: str) -> dict[str, int]:
    # 도시명에 '도쿄/Tokyo' 같은 변형이 있을 수 있어 부분 일치까지 허용
    if not city:
        return _DEFAULT_PRICES
    for key, prices in _CITY_PRICES.items():
        if key in city or city in key:
            return prices
    return _DEFAULT_PRICES


async def execute_estimate_budget(
    date: str,
    _day_plans: list | None = None,
    city: str | None = None,
    **_: object,
) -> dict:
    if not _day_plans:
        return {"error": "현재 일정 정보가 없어 예산 추정이 불가능합니다"}

    target = next((dp for dp in _day_plans if getattr(dp, "date", None) == date), None)
    if target is None:
        return {"error": f"'{date}' 날짜의 일정을 찾을 수 없습니다"}

    raw_places = getattr(target, "places", []) or []
    names = [
        p if isinstance(p, str) else (getattr(p, "name", "") or "")
        for p in raw_places
    ]
    names = [n for n in names if n]

    if not names:
        return {
            "date": date,
            "verdict": "비어있음",
            "advice": "장소가 없어 예산 추정 불가",
        }

    prices = _price_table(city or "")
    counts = {"restaurant": 0, "cafe": 0, "tourist": 0}
    for n in names:
        counts[_classify(n)] += 1

    # 1인 기준 — 카테고리 분류된 만큼만 단가 합산
    meal_cost = counts["restaurant"] * prices["meal"]
    cafe_cost = counts["cafe"] * prices["cafe"]
    entry_cost = counts["tourist"] * prices["entry"]
    subtotal = meal_cost + cafe_cost + entry_cost

    # 교통·잡비 보정 — 일정에 잡힌 항목의 20% 추가
    misc = int(subtotal * 0.2)
    total = subtotal + misc

    return {
        "date": date,
        "city": city or "기본 단가",
        "per_person_total_krw": total,
        "breakdown": {
            "식사": meal_cost,
            "카페": cafe_cost,
            "입장료": entry_cost,
            "교통·잡비(추정)": misc,
        },
        "counts": counts,
        "note": "도시별 평균 단가 기반 휴리스틱 추정 — 1인 기준, 실제와 차이 있을 수 있음",
    }
