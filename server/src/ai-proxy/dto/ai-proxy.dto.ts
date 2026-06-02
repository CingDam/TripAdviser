import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ai-server core/models.py의 Pydantic 모델과 동일한 구조 — 클라이언트 입력 검증용

// places는 하위호환을 위해 string 또는 { name, lat?, lng? } 객체 모두 허용
// 좌표를 함께 보내면 ai-server의 get_directions tool이 Haversine 거리 추정 가능
export class ChatDayPlan {
  @IsString()
  @MaxLength(10)
  date: string;

  @IsArray()
  places: (string | { name: string; lat?: number; lng?: number })[];
}

export class ChatHistoryContext {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;
}

export class ChatHistory {
  @IsString()
  @MaxLength(10)
  role: string;

  @IsString()
  @MaxLength(1000)
  text: string;

  @IsOptional()
  context?: ChatHistoryContext;
}

export class NearbyPlace {
  @IsString()
  name: string;

  @IsString()
  formatted_address: string;

  @IsNumber()
  @IsOptional()
  rating?: number;

  @IsNumber()
  @IsOptional()
  user_ratings_total?: number;

  @IsNumber()
  @IsOptional()
  price_level?: number;
}

export class ChatRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsArray()
  @IsOptional()
  day_plans?: ChatDayPlan[];

  @IsArray()
  @IsOptional()
  history?: ChatHistory[];

  // 실시간 근처 장소 — 클라이언트가 맛집/카페 등 키워드 감지 시 nearby API 결과를 함께 전송
  @IsArray()
  @IsOptional()
  nearby_places?: NearbyPlace[];

  // nearby 검색에 사용된 카테고리 — AI가 어떤 요청인지 파악하는 데 사용
  @IsString()
  @IsOptional()
  @MaxLength(20)
  nearby_category?: string;

  // Agent의 search_places·get_weather tool 컨텍스트 — 현재 일정 중심 좌표
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  center_lat?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  center_lng?: number;
}

export class GenerateRequest {
  @IsString()
  @MaxLength(100)
  city: string;

  @IsArray()
  dates: string[];

  // 날짜별 방문 도시 매핑 — {"2025-06-01": "오사카", "2025-06-02": "교토"}
  @IsOptional()
  day_cities?: Record<string, string>;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  style?: string;

  // 숙소명 — 도시 이동일 출발 역/터미널 추론용. DTO 누락 시 whitelist가 잘라내 ai-server에 전달 안 됨
  @IsString()
  @IsOptional()
  @MaxLength(200)
  hotel_name?: string;

  // 사용자가 꼭 가고 싶다고 언급한 장소·랜드마크·세부지역 — 자동생성 일정에 강제 포함
  @IsArray()
  @IsOptional()
  must_visit?: string[];
}

export class SortPlace {
  @IsString()
  place_id: string;

  @IsString()
  name: string;

  @IsString()
  formatted_address: string;

  location: { lat: number; lng: number };
  types: string[];

  @IsNumber()
  @IsOptional()
  rating?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  user_ratings_total?: number;

  @IsNumber()
  @IsOptional()
  priceLevel?: number;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsString()
  @IsOptional()
  timeSlot?: string;
}

export class SortRequest {
  @IsArray()
  places: SortPlace[];

  @IsString()
  @MaxLength(10)
  date: string;
}

export class TransitCandidate {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  formatted_address?: string;
}

export class SelectTransitRequest {
  @IsString()
  @MaxLength(200)
  from_place: string;

  @IsString()
  @MaxLength(200)
  to_place: string;

  @IsArray()
  candidates: TransitCandidate[];
}
