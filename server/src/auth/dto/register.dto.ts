import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(1, 15)
  name!: string;

  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다' })
  email!: string;

  // 대문자·소문자·숫자 각 1자 이상 필수 — NIST SP 800-63B 기반 최소 복잡도 정책
  @IsString()
  @Length(8, 255)
  @Matches(/^(?=.*[a-z])(?=.*\d).+$/, {
    message: '비밀번호는 영문자와 숫자를 모두 포함해야 합니다',
  })
  pw!: string;
}
