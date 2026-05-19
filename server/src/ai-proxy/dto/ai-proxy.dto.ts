import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ai-server core/models.py의 Pydantic 모델과 동일한 구조 — 클라이언트 입력 검증용

export class ChatDayPlan {
  @IsString()
  @MaxLength(10)
  date: string;

  @IsArray()
  places: string[];
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
}

export class GenerateRequest {
  @IsString()
  @MaxLength(100)
  city: string;

  @IsArray()
  dates: string[];

  @IsString()
  @IsOptional()
  @MaxLength(100)
  style?: string;
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
