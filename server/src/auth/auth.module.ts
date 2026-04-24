import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { SocialLogin } from './entities/social-login.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { KakaoStrategy } from './kakao.strategy';
import { NaverStrategy } from './naver.strategy';
import { MailService } from './mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, SocialLogin]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>(
            'JWT_EXPIRES_IN',
          ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    KakaoStrategy,
    NaverStrategy,
    MailService,
  ],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
