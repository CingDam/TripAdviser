import { IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @Length(1, 100)
  title!: string;

  @IsString()
  @Length(1)
  content!: string;

  @IsOptional()
  @IsNumber()
  cityNum?: number;

  // 첨부할 내 일정 번호 — 본인 소유 검증은 Service에서 수행
  @IsOptional()
  @IsNumber()
  planNum?: number;
}
