import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsOptional()
  @IsInt()
  cityNum?: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  placeId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  locationName?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  content?: string;
}
