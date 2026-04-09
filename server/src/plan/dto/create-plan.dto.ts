import { IsDateString, IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class CreatePlanDto {
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
}
