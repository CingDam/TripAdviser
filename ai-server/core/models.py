import re
from pydantic import BaseModel, Field, field_validator, ConfigDict

# Google Places ID 형식 — ChIJ로 시작하는 영문+숫자 27자
_PLACE_ID_RE = re.compile(r'^[A-Za-z0-9_\-]{10,100}$')
# 날짜 형식 — YYYY-MM-DD
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
# 항공편 시각 형식 — HH:mm (24시간). 첫날/마지막날 가용시간 판단용
_TIME_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')

class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)

class Place(BaseModel):
    # 클라이언트(GooglePlace)가 보내는 extra 필드(icon, openNow 등)를 조용히 무시
    model_config = ConfigDict(extra='ignore')

    place_id: str = Field(max_length=100)
    name: str = Field(max_length=200)
    formatted_address: str = Field(max_length=300)
    location: Location
    types: list[str] = Field(max_length=20)
    rating: float | None = Field(default=None, ge=0, le=5)
    user_ratings_total: int | None = Field(default=None, ge=0)
    priceLevel: int | None = Field(default=None, ge=0, le=4)
    photoUrl: str | None = Field(default=None, max_length=500)
    # AI 정렬 결과로 부착된 시간대 — 재정렬 요청 시 이전 값이 실려올 수 있어 허용
    timeSlot: str | None = Field(default=None)

    @field_validator('place_id')
    @classmethod
    def validate_place_id(cls, v: str) -> str:
        if not _PLACE_ID_RE.match(v):
            raise ValueError('유효하지 않은 place_id 형식')
        return v

class SortRequest(BaseModel):
    # 하루 일정은 최대 20개 — 그 이상은 LLM 호출 비용·컨텍스트 초과 위험
    places: list[Place] = Field(max_length=20)
    date: str = Field(max_length=10)
    # 현지 차량 이용 여부 — False면 이동수단 추정에서 '차량'을 제외하고 대중교통으로만 분류
    use_car: bool = True

    @field_validator('date')
    @classmethod
    def validate_date(cls, v: str) -> str:
        if not _DATE_RE.match(v):
            raise ValueError('날짜 형식은 YYYY-MM-DD이어야 합니다')
        return v

class SortedPlace(BaseModel):
    place: Place
    # 시간대 레이블 — LLM이 부여 (오전·점심·오후·저녁·야간)
    time_slot: str
    # 직전 장소에서 이 장소로 오는 이동수단 — LLM이 거리·도시 규모로 추정 (도보·전철·버스·기차·차량)
    # 첫 장소는 직전 구간이 없어 None. 환승은 실제 노선 데이터가 없어 LLM 상식 추론(추정값)
    transit_mode: str | None = None

class SortResponse(BaseModel):
    places: list[SortedPlace]


# ── 채팅 모델 ──────────────────────────────────────────────────────────────────

class ChatPlaceBrief(BaseModel):
    """대화 컨텍스트용 장소 요약 — 이름과 좌표만, 평점·사진 등은 챗봇 컨텍스트에 불필요"""
    model_config = ConfigDict(extra='ignore')
    name: str = Field(max_length=200)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class ChatDayPlan(BaseModel):
    """클라이언트가 전송하는 날짜별 일정 요약 (컨텍스트용)

    places는 하위호환을 위해 문자열 또는 ChatPlaceBrief를 둘 다 허용.
    좌표가 있는 경우 get_directions 같은 tool이 활용한다.
    """
    model_config = ConfigDict(extra='ignore')
    date: str = Field(max_length=10)
    places: list[str | ChatPlaceBrief] = Field(max_length=20)
    # 첫날 현지 도착 시각 "HH:mm" — 오후 반나절 판단용 (클라이언트가 첫날에만 첨부)
    arrival_time: str | None = Field(default=None, max_length=5)
    # 마지막날 출국 시각 "HH:mm" — 귀국일/오전 반나절 판단용 (클라이언트가 마지막날에만 첨부)
    departure_time: str | None = Field(default=None, max_length=5)

    @field_validator('arrival_time', 'departure_time')
    @classmethod
    def validate_time(cls, v: str | None) -> str | None:
        # 형식이 어긋나면 무시(None) — 시각은 보조 신호라 검증 실패로 전체 요청을 깨뜨리지 않는다
        if v is None or not _TIME_RE.match(v):
            return None
        return v

class ChatHistoryContext(BaseModel):
    """히스토리 턴에 붙는 추가 맥락 — 대화 중 언급된 도시 등"""
    model_config = ConfigDict(extra='ignore')
    # 해당 턴에서 사용자가 언급하거나 AI가 답변한 도시명 — 빈 문자열이면 맥락 없음
    city: str = Field(default="", max_length=100)

class ChatHistory(BaseModel):
    """이전 대화 턴 — role은 'user' 또는 'ai'"""
    model_config = ConfigDict(extra='ignore')
    role: str = Field(max_length=10)
    text: str = Field(max_length=1000)
    # 해당 턴의 도시 맥락 — 대화 중 도시 전환을 추적하기 위해 사용
    context: ChatHistoryContext | None = Field(default=None)

class NearbyPlace(BaseModel):
    """클라이언트가 Places API로 조회한 실시간 근처 장소 — AI 컨텍스트 주입용"""
    model_config = ConfigDict(extra='ignore')
    name: str = Field(max_length=200)
    formatted_address: str = Field(default="", max_length=300)
    rating: float | None = Field(default=None, ge=0, le=5)
    user_ratings_total: int | None = Field(default=None, ge=0)
    price_level: int | None = Field(default=None, ge=0, le=4)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    city: str = Field(max_length=100)
    # 현재 dayPlans 컨텍스트 — 없으면 빈 리스트 (일정 미확정 상태)
    day_plans: list[ChatDayPlan] = Field(default=[], max_length=30)
    # 이전 대화 히스토리 — 최근 N턴, 없으면 빈 리스트
    # 20턴까지 받고, ai-server에서 7번째 이전 턴은 LLM 요약으로 압축해 system에 prepend
    history: list[ChatHistory] = Field(default=[], max_length=20)
    # 실시간 근처 장소 — 클라이언트가 맛집/카페 등 키워드 감지 시 전송
    nearby_places: list[NearbyPlace] = Field(default=[], max_length=10)
    # nearby 검색 카테고리 — AI가 어떤 유형의 추천 요청인지 파악하는 데 사용
    nearby_category: str = Field(default="", max_length=20)
    # 현재 일정 중심 좌표 — Agent의 search_places·get_weather tool에 주입
    # 클라이언트가 dayPlans 평균으로 계산해 전송. 없으면 tool이 위치 안내 메시지 반환
    center_lat: float | None = Field(default=None, ge=-90, le=90)
    center_lng: float | None = Field(default=None, ge=-180, le=180)

class GenerateRequest(BaseModel):
    city: str = Field(max_length=100)
    # 날짜 목록 — YYYY-MM-DD 형식, 최대 14박
    dates: list[str] = Field(min_length=1, max_length=15)
    # 날짜별 방문 도시 매핑 — {"2025-06-01": "오사카", "2025-06-02": "교토"}
    # 비어 있으면 city 단일 도시로 전체 생성
    day_cities: dict[str, str] = Field(default={})
    # 여행 스타일·원문 힌트 (선택) — "맛집 위주", 사용자 원문 메시지 등 AI가 장소 수·카테고리 비중 결정에 활용
    style: str | None = Field(default=None, max_length=500)
    # 숙소명 (선택) — 도시 이동일에 출발 역/터미널 추론용
    hotel_name: str | None = Field(default=None, max_length=200)
    # 사용자가 꼭 가고 싶다고 언급한 장소·랜드마크·세부지역 — 해당 도시 날짜에 강제 포함
    must_visit: list[str] = Field(default=[], max_length=10)
    # 이미 채워진 날 중 다시 짤 날짜 — 클라이언트가 이 날의 기존 장소를 비우고 재생성
    regenerate_dates: list[str] = Field(default=[], max_length=15)
    # 첫날 현지 도착 시각 "HH:mm" — 오후 반나절 장소 수 차등용
    arrival_time: str | None = Field(default=None, max_length=5)
    # 마지막날 출국 시각 "HH:mm" — 귀국일/오전 반나절 장소 수 차등용
    departure_time: str | None = Field(default=None, max_length=5)
    # 1인 기준 전체 예산(KRW) — 있으면 그 안에 맞춰 장소 등급·수를 조절. 없으면 제약 없음
    # 항공·숙박 제외, 현지 식음료·입장료·교통/잡비 기준 (estimate_budget과 동일 범위)
    # gt=0 — 0원은 의미 없는 예산이므로 '미설정(None)'과 구분하지 않고 아예 거부한다
    budget_krw: int | None = Field(default=None, gt=0, le=100_000_000)

    @field_validator('arrival_time', 'departure_time')
    @classmethod
    def validate_time(cls, v: str | None) -> str | None:
        # 보조 신호 — 형식 어긋나면 None으로 무시 (요청 전체를 깨뜨리지 않음)
        if v is None or not _TIME_RE.match(v):
            return None
        return v

    @field_validator('dates')
    @classmethod
    def validate_dates(cls, v: list[str]) -> list[str]:
        for d in v:
            if not _DATE_RE.match(d):
                raise ValueError(f'날짜 형식은 YYYY-MM-DD이어야 합니다: {d}')
        return v

class GeneratedPlace(BaseModel):
    name: str
    category: str  # 관광지·식당·카페·쇼핑 등
    reason: str    # 추천 이유 한 줄
    # 이 장소가 속한 도시 — 하루 안에서 도시가 바뀌는 날(교토 오후→오사카 복귀 저녁)에
    # 장소마다 도시가 달라 명시. 비면 클라이언트가 날짜 도시(dp.city)로 폴백한다
    city: str = ""

class GenerateDayPlan(BaseModel):
    date: str
    city: str = ""  # 해당 날 방문 도시(대표) — 다도시 여행 시 resolve 정확도 향상
    places: list[GeneratedPlace]

class BudgetEstimate(BaseModel):
    # 생성된 일정 전체의 1인 예상 비용(KRW) — 항공·숙박 제외
    estimated_total_krw: int
    # 요청 예산 대비 초과 여부 — 클라이언트가 초과 시 경고 표시
    over_budget: bool
    # 한 줄 설명 (예: "예산에 맞춰 로컬 맛집 위주로 구성")
    note: str = ""

class GenerateResponse(BaseModel):
    city: str
    day_plans: list[GenerateDayPlan]
    # 예산이 지정된 요청에만 채워진다 — 미지정이면 None
    budget_estimate: BudgetEstimate | None = None

class TransitCandidate(BaseModel):
    """교통 거점 후보 — NestJS nearby-transit 결과"""
    model_config = ConfigDict(extra='ignore')
    name: str = Field(max_length=200)
    formatted_address: str = Field(default="", max_length=300)

class SelectTransitRequest(BaseModel):
    """두 장소 사이 중간 역 선택 요청"""
    from_place: str = Field(max_length=200)
    to_place: str = Field(max_length=200)
    candidates: list[TransitCandidate] = Field(min_length=1, max_length=5)

class SelectTransitResponse(BaseModel):
    """Gemini가 선택한 최적 교통 거점명"""
    name: str

class ChatActionPlace(BaseModel):
    name: str = Field(max_length=200)
    category: str | None = Field(default=None, max_length=20)

class GenerateAction(BaseModel):
    # 전체 일정 자동생성 제안 — 클라이언트가 [생성] 버튼 클릭 시 runFullGenerate 실행
    city: str = Field(max_length=100)
    # 날짜별 방문 도시 매핑 — 비어 있으면 단일 도시(city)로 전체 생성
    day_cities: dict[str, str] = Field(default={})
    # 여행 스타일·원문 힌트 — 장소 수·카테고리 비중 결정용
    style: str | None = Field(default=None, max_length=500)
    # 사용자가 꼭 가고 싶다고 언급한 장소·랜드마크·세부지역 — 해당 도시 날짜에 강제 포함
    must_visit: list[str] = Field(default=[], max_length=10)
    # 이미 채워진 날 중 다시 짤 날짜 — 클라이언트가 [생성] 시 기존 장소를 비우고 재생성
    regenerate_dates: list[str] = Field(default=[], max_length=15)

class ChatAction(BaseModel):
    # 장소 제안 액션 — 클라이언트가 날짜 선택 후 resolve → dayPlans 삽입
    places: list[ChatActionPlace] = Field(max_length=10)
    # 어떤 날짜에 추가할지 AI가 명시한 경우 — 비어 있으면 클라이언트가 사용자에게 선택받음
    target_date: str | None = Field(default=None, max_length=10)
    # 교체 시 제거 대상 장소명 — propose_replace_places tool 결과
    remove_names: list[str] = Field(default=[], max_length=10)
    # 장소를 찾은 도시 — conversation_city가 스토어 city와 다를 때 resolve 정확도 보장
    city: str | None = Field(default=None, max_length=100)
    # 전체 일정 자동생성 제안 — generate_full_itinerary tool 결과 (있으면 클라이언트가 생성 확인 카드 표시)
    generate: GenerateAction | None = Field(default=None)

class ChatResponse(BaseModel):
    reply: str
    # action이 있으면 클라이언트에서 날짜 드롭다운 + 추가 버튼 UI 표시
    action: ChatAction | None = None
    # AI가 직접 제안하는 후속 질문 — 없으면 클라이언트가 응답 분석으로 생성
    follow_ups: list[str] = Field(default=[])
