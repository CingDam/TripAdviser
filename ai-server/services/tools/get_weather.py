"""Open-Meteo 무료 API로 도시의 7일 예보를 조회한다.

클라이언트(CityHubClient)에서 이미 사용 중인 API — 동일 weathercode 매핑 사용.
API 키 불필요·rate limit 무제한(개인 용도) — 별도 환경변수 설정 없음.
"""
import logging

import httpx

from core.city_coords import get_city_coords

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

GET_WEATHER_SCHEMA = {
    "name": "get_weather",
    "description": (
        "특정 날짜의 도시 날씨 예보를 조회한다. "
        "비·눈 예보가 있는지, 기온이 어떤지 확인해 실내/야외 일정을 조정할 때 사용한다. "
        "오늘부터 최대 7일 이내 날짜만 조회 가능."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": "YYYY-MM-DD 형식 날짜 — 예: '2026-05-20'",
            },
        },
        "required": ["date"],
    },
}


async def execute_get_weather(
    date: str,
    center_lat: float | None = None,
    center_lng: float | None = None,
    city_name: str = "",
    **_: object,  # agent_service가 주입하는 city 등 미사용 컨텍스트 흡수
) -> dict:
    """주어진 날짜의 날씨 요약 반환.

    center_lat/lng는 agent_service가 현재 일정 중심 좌표로 주입.
    좌표 없으면 도시명만으로는 조회 불가하므로 안내 메시지 반환.
    """
    if center_lat is None or center_lng is None:
        # search_places와 동일한 폴백 — 도시명으로 좌표 추론
        fallback = get_city_coords(city_name)
        if fallback:
            center_lat, center_lng = fallback
            logger.info("get_weather 폴백 좌표 사용 — city:%s lat:%.4f lng:%.4f", city_name, center_lat, center_lng)
        else:
            return {"error": "위치 정보가 없어 날씨를 조회할 수 없습니다"}

    params = {
        "latitude": center_lat,
        "longitude": center_lng,
        "daily": "temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max",
        "timezone": "auto",
        "forecast_days": 7,
        "start_date": date,
        "end_date": date,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        logger.warning("get_weather 호출 실패 — date:%s error:%s", date, type(e).__name__)
        return {"error": "날씨 조회 실패"}

    try:
        daily = data["daily"]
        if not daily.get("time"):
            return {"error": "해당 날짜의 예보가 없습니다 (7일 이후는 조회 불가)"}
        return {
            "city": city_name,
            "date": date,
            "max_temp_c": daily["temperature_2m_max"][0],
            "min_temp_c": daily["temperature_2m_min"][0],
            "condition": _decode_weather_code(daily["weathercode"][0]),
            "precipitation_probability": daily.get("precipitation_probability_max", [None])[0],
        }
    except (KeyError, IndexError, TypeError):
        return {"error": "예보 응답 형식 오류"}


# CityHubClient의 getWeatherInfo와 동일한 weathercode 범주 — 일관성 유지
def _decode_weather_code(code: int | None) -> str:
    if code is None:
        return "알 수 없음"
    if code == 0:
        return "맑음"
    if code <= 2:
        return "대체로 맑음"
    if code == 3:
        return "흐림"
    if code <= 48:
        return "안개"
    if code <= 55:
        return "이슬비"
    if code <= 65:
        return "비"
    if code <= 77:
        return "눈"
    if code <= 82:
        return "소나기"
    if code <= 86:
        return "눈 소나기"
    return "뇌우"
