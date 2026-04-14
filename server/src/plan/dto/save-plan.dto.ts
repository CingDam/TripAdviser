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

  @IsOptional()
  @IsNumber()
  cityNum?: number;

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
