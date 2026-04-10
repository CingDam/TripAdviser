import { IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(1)
  content!: string;

  // NULL이면 최상위 댓글, 값이 있으면 대댓글
  @IsOptional()
  @IsNumber()
  parentCommentNum?: number;
}
