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
}
