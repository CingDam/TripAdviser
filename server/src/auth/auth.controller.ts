import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Next,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response, NextFunction } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const passport = require('passport') as typeof import('passport');

// passport.authenticate()의 반환 타입 — RequestHandler와 동일
type PassportHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;
const runPassport = (strategy: string, options: Record<string, unknown>) =>
  passport.authenticate(strategy, options) as PassportHandler;
import { AuthService, SocialProfile } from './auth.service';
import { SocialProvider } from './entities/social-login.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendVerificationDto } from './dto/send-verification.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

interface JwtUser {
  userNum: number;
  email: string | null;
  name: string;
}
interface JwtRequest extends Request {
  user: JwtUser;
}

type OAuthCallbackUser =
  | { accessToken: string }
  | { linkMode: true; profile: SocialProfile };
interface OAuthCallbackRequest extends Request {
  user: OAuthCallbackUser;
}

@Controller('auth')
export class AuthController {
  private readonly clientUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    this.clientUrl =
      config.get<string>('CLIENT_URL') ?? 'http://localhost:3000';
  }

  // 이메일 발송은 외부 API 비용이 발생하므로 분당 5회로 제한
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('send-verification')
  @HttpCode(200)
  sendVerification(@Body() dto: SendVerificationDto) {
    return this.authService.sendVerification(dto.email);
  }

  @Post('verify-code')
  @HttpCode(200)
  verifyCode(@Body() dto: VerifyCodeDto) {
    this.authService.verifyCode(dto.email, dto.code);
    return { verified: true };
  }

  // 회원가입·로그인은 브루트포스 방지를 위해 분당 10회로 제한
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ── 소셜 로그인 (신규 로그인 / 회원가입) ──────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    /* passport가 리다이렉트 처리 */
  }

  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  kakaoLogin() {}

  @Get('naver')
  @UseGuards(AuthGuard('naver'))
  naverLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: OAuthCallbackRequest, @Res() res: Response) {
    await this.handleOAuthCallback(req, res, 'google');
  }

  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  async kakaoCallback(@Req() req: OAuthCallbackRequest, @Res() res: Response) {
    await this.handleOAuthCallback(req, res, 'kakao');
  }

  @Get('naver/callback')
  @UseGuards(AuthGuard('naver'))
  async naverCallback(@Req() req: OAuthCallbackRequest, @Res() res: Response) {
    await this.handleOAuthCallback(req, res, 'naver');
  }

  // ── 소셜 계정 연동 (로그인된 사용자 → 기존 계정에 소셜 추가) ──────────

  // step 1: JWT로 인증 후 단기 linkCode 발급
  @Post('link-init/:provider')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  linkInit(@Req() req: JwtRequest) {
    const code = this.authService.generateLinkCode(req.user.userNum);
    return { code };
  }

  // step 2: 브라우저가 이 URL로 이동 → OAuth 제공자로 리다이렉트 (linkCode를 state로 전달)
  @Get('google/link')
  googleLinkStart(
    @Query('lk') code: string,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    if (!this.authService.isValidLinkCode(code)) {
      res.redirect(`${this.clientUrl}/mypage?error=invalid_link`);
      return;
    }
    runPassport('google', { scope: ['email', 'profile'], state: code })(
      req,
      res,
      next,
    );
  }

  @Get('kakao/link')
  kakaoLinkStart(
    @Query('lk') code: string,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    if (!this.authService.isValidLinkCode(code)) {
      res.redirect(`${this.clientUrl}/mypage?error=invalid_link`);
      return;
    }
    runPassport('kakao', { state: code })(req, res, next);
  }

  @Get('naver/link')
  naverLinkStart(
    @Query('lk') code: string,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    if (!this.authService.isValidLinkCode(code)) {
      res.redirect(`${this.clientUrl}/mypage?error=invalid_link`);
      return;
    }
    runPassport('naver', { state: code })(req, res, next);
  }

  // ── 연동된 소셜 계정 조회 / 해제 ─────────────────────────────────────

  @Get('me/social-links')
  @UseGuards(AuthGuard('jwt'))
  getSocialLinks(@Req() req: JwtRequest) {
    return this.authService.getSocialLinks(req.user.userNum);
  }

  @Delete('social-links/:provider')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  async unlinkSocial(
    @Param('provider') provider: SocialProvider,
    @Req() req: JwtRequest,
  ) {
    await this.authService.unlinkSocial(req.user.userNum, provider);
    return { success: true };
  }

  // ── 공통 OAuth 콜백 핸들러 ────────────────────────────────────────────

  private async handleOAuthCallback(
    req: OAuthCallbackRequest,
    res: Response,
    provider: string,
  ) {
    if ('linkMode' in req.user && req.user.linkMode) {
      // 연동 모드 — linkCode(=state)를 소비하고 소셜 계정을 기존 유저에 추가
      const state = req.query?.state as string | undefined;
      try {
        await this.authService.linkSocial(state ?? '', req.user.profile);
        res.redirect(`${this.clientUrl}/mypage?linked=${provider}`);
      } catch {
        res.redirect(`${this.clientUrl}/mypage?error=link_failed`);
      }
    } else {
      // 일반 로그인 모드 — union 타입 narrowing이 안 되므로 명시적 단언
      const user = req.user as { accessToken: string };
      res.redirect(`${this.clientUrl}/auth/callback?token=${user.accessToken}`);
    }
  }
}
