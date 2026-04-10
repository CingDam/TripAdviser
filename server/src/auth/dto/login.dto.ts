import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다' })
  email!: string;

  @IsString()
  pw!: string;
}
