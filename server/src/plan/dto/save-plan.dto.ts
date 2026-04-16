import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateIf } from 'class-validator';

export class SaveDayPlanItemDto {
  @IsDateString()
  planDate: string;

  @IsNumber()
  sortOrder: number;

  @IsOptional()
  @IsString()
  placeId?: string | null;

  @IsOptional()
  @IsString()
  locationName?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsNumber()
  lat?: number | null;

  @IsOptional()
  @IsNumber()
  lng?: number | null;

  @IsOptional()
  @IsString()
  tel?: string | null;
}

export class SavePlanDto {
  @IsString()
  @Length(1, 45)
  planName: string;

  // DB에 등록된 도시를 선택한 경우
  @IsOptional()
  @IsNumber()
  cityNum?: number;

  // DB에 없는 도시를 직접 입력한 경우 — cityNum이 없을 때만 사용
  @ValidateIf((o: SavePlanDto) => o.cityNum === undefined)
  @IsOptional()
  @IsString()
  @Length(1, 50)
  cityName?: string;

  @ValidateIf((o: SavePlanDto) => o.cityNum === undefined)
  @IsOptional()
  @IsString()
  @Length(1, 50)
  country?: string;

  @IsOptional()
  @IsNumber()
  cityLat?: number;

  @IsOptional()
  @IsNumber()
  cityLng?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveDayPlanItemDto)
  dayPlans: SaveDayPlanItemDto[];
}
