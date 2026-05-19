import re
from pydantic import BaseModel, Field, field_validator, ConfigDict

# Google Places ID 형식 — ChIJ로 시작하는 영문+숫자 27자
_PLACE_ID_RE = re.compile(r'^[A-Za-z0-9_\-]{10,100}$')
# 날짜 형식 — YYYY-MM-DD
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

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

class SortResponse(BaseModel):
    places: list[SortedPlace]


# ── 채팅 모델 ──────────────────────────────────────────────────────────────────

class ChatDayPlan(BaseModel):
    """클라이언트가 전송하는 날짜별 일정 요약 (컨텍스트용)"""
    model_config = ConfigDict(extra='ignore')
    date: str = Field(max_length=10)
    places: list[str] = Field(max_length=20)  # 장소명 목록

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

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    city: str = Field(max_length=100)
    # 현재 dayPlans 컨텍스트 — 없으면 빈 리스트 (일정 미확정 상태)
    day_plans: list[ChatDayPlan] = Field(default=[], max_length=30)
    # 이전 대화 히스토리 — 최근 N턴, 없으면 빈 리스트
    history: list[ChatHistory] = Field(default=[], max_length=10)

class GenerateRequest(BaseModel):
    city: str = Field(max_length=100)
    # 날짜 목록 — YYYY-MM-DD 형식, 최대 14박
    dates: list[str] = Field(min_length=1, max_length=15)
    # 여행 스타일 힌트 (선택) — "맛집 위주", "자연·힐링" 등
    style: str | None = Field(default=None, max_length=100)

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

class GenerateDayPlan(BaseModel):
    date: str
    city: str = ""  # 해당 날 방문 도시 — 다도시 여행 시 resolve 정확도 향상
    places: list[GeneratedPlace]

class GenerateResponse(BaseModel):
    city: str
    day_plans: list[GenerateDayPlan]

class ChatActionPlace(BaseModel):
    name: str = Field(max_length=200)
    category: str | None = Field(default=None, max_length=20)

class ChatAction(BaseModel):
    # 장소 제안 액션 — 클라이언트가 날짜 선택 후 resolve → dayPlans 삽입
    places: list[ChatActionPlace] = Field(max_length=10)

class ChatResponse(BaseModel):
    reply: str
    # action이 있으면 클라이언트에서 날짜 드롭다운 + 추가 버튼 UI 표시
    action: ChatAction | None = None
