import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { Request } from 'express';
import { AuthService, SocialProfile } from './auth.service';

interface KakaoProfile {
  id: number;
  displayName: string;
  _json: {
    kakao_account?: {
      email?: string;
      profile?: { nickname?: string; profile_image_url?: string };
    };
  };
}

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.getOrThrow<string>('KAKAO_CLIENT_ID'),
      clientSecret: config.get<string>('KAKAO_CLIENT_SECRET') ?? '',
      callbackURL: config.getOrThrow<string>('KAKAO_CALLBACK_URL'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: KakaoProfile,
  ): Promise<
    { accessToken: string } | { linkMode: true; profile: SocialProfile }
  > {
    const account = profile._json.kakao_account;
    const socialProfile: SocialProfile = {
      provider: 'kakao',
      providerId: String(profile.id),
      email: account?.email ?? null,
      name: account?.profile?.nickname ?? profile.displayName,
      profileImg: account?.profile?.profile_image_url ?? null,
    };

    const state = req.query?.state as string | undefined;
    if (state && this.authService.isValidLinkCode(state)) {
      return { linkMode: true, profile: socialProfile };
    }

    return this.authService.socialLogin(socialProfile);
  }
}
