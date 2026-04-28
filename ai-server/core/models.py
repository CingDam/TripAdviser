import re
from pydantic import BaseModel, Field, field_validator

# Google Places ID 형식 — ChIJ로 시작하는 영문+숫자 27자
_PLACE_ID_RE = re.compile(r'^[A-Za-z0-9_\-]{10,100}$')
# 날짜 형식 — YYYY-MM-DD
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)

class Place(BaseModel):
    place_id: str = Field(max_length=100)
    name: str = Field(max_length=200)
    formatted_address: str = Field(max_length=300)
    location: Location
    types: list[str] = Field(max_length=20)
    rating: float | None = Field(default=None, ge=0, le=5)
    photoUrl: str | None = Field(default=None, max_length=500)

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

class SortResponse(BaseModel):
    places: list[Place]