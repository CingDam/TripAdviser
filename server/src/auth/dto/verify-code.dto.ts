import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyCodeDto {
  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다' })
  email: string;

  @IsString()
  @Length(6, 6, { message: '인증코드는 6자리입니다' })
  code: string;
}
