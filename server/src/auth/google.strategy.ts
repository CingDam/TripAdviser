import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { Request } from 'express';
import { AuthService, SocialProfile } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<
    { accessToken: string } | { linkMode: true; profile: SocialProfile }
  > {
    const socialProfile: SocialProfile = {
      provider: 'google',
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      name: profile.displayName,
      profileImg: profile.photos?.[0]?.value ?? null,
    };

    // state가 유효한 연동 코드면 링크 모드 — 컨트롤러에서 linkSocial 처리
    const state = req.query?.state as string | undefined;
    if (state && this.authService.isValidLinkCode(state)) {
      return { linkMode: true, profile: socialProfile };
    }

    return this.authService.socialLogin(socialProfile);
  }
}
