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

export class ChatHistory {
  @IsString()
  @MaxLength(10)
  role: string;

  @IsString()
  @MaxLength(1000)
  text: string;
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
