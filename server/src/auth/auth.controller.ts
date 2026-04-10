import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendVerificationDto } from './dto/send-verification.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/send-verification — 이메일로 6자리 인증코드 발송
  @Post('send-verification')
  @HttpCode(200)
  sendVerification(@Body() dto: SendVerificationDto) {
    return this.authService.sendVerification(dto.email);
  }

  // POST /auth/verify-code — 인증코드 확인
  @Post('verify-code')
  @HttpCode(200)
  verifyCode(@Body() dto: VerifyCodeDto) {
    this.authService.verifyCode(dto.email, dto.code);
    return { verified: true };
  }

  // POST /auth/register — 이메일 인증 완료 후 회원가입
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /auth/login
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
