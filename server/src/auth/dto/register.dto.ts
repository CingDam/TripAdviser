import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(1, 15)
  name!: string;

  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다' })
  email!: string;

  // 소문자·숫자·특수문자 각 1자 이상 필수 — 클라이언트 PW_REQUIREMENTS와 동일 기준
  @IsString()
  @Length(8, 255)
  @Matches(/^(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: '비밀번호는 영문 소문자·숫자·특수문자를 모두 포함해야 합니다',
  })
  pw!: string;
}
