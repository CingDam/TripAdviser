import { IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1)
  content?: string;

  @IsOptional()
  @IsNumber()
  cityNum?: number;
}
