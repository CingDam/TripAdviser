import { IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(1, 15)
  name: string;

  @IsString()
  @Length(4, 45)
  id: string;

  @IsString()
  @Length(8, 255)
  pw: string;
}
