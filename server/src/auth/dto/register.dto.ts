import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(1, 15)
  name!: string;

  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다' })
  email!: string;

  // 소문자·숫자·ASCII 특수문자 각 1자 이상 필수 — 클라이언트 PW_REQUIREMENTS와 동일 기준
  // 허용 문자셋을 ASCII 영숫자+특수문자로 한정 — 공백·한글·이모지는 입력 단계에서 거부
  // [!-~]는 ASCII 33(!)~126(~) 출력 가능 문자 전체 = 영숫자 + 특수문자, 공백(32)·제어문자 제외
  @IsString()
  @Length(8, 255)
  @Matches(/^(?=.*[a-z])(?=.*\d)(?=.*[!-/:-@[-`{-~])[!-~]+$/, {
    message:
      '비밀번호는 영문 소문자·숫자·특수문자를 모두 포함하고 공백 없이 입력해야 합니다',
  })
  pw!: string;
}
