import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-naver-v2';
import { Request } from 'express';
import { AuthService, SocialProfile } from './auth.service';

interface NaverProfile {
  id: string;
  displayName: string;
  email: string | null;
  profileImage: string | null;
}

@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, 'naver') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.getOrThrow<string>('NAVER_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('NAVER_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('NAVER_CALLBACK_URL'),
      // passport-naver-v2 타입이 passReqToCallback을 누락했지만 기반 passport-oauth2는 지원
      passReqToCallback: true as unknown as false,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: NaverProfile,
  ): Promise<
    { accessToken: string } | { linkMode: true; profile: SocialProfile }
  > {
    const socialProfile: SocialProfile = {
      provider: 'naver',
      providerId: profile.id,
      email: profile.email ?? null,
      name: profile.displayName,
      profileImg: profile.profileImage ?? null,
    };

    const state = req.query?.state as string | undefined;
    if (state && this.authService.isValidLinkCode(state)) {
      return { linkMode: true, profile: socialProfile };
    }

    return this.authService.socialLogin(socialProfile);
  }
}
