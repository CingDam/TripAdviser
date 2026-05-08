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

  // null 전달 시 첨부 해제 — undefined와 구분하기 위해 IsOptional만 사용
  @IsOptional()
  @IsNumber()
  planNum?: number | null;
}
