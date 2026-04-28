import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { CityModule } from './city/city.module';
import { CommunityModule } from './community/community.module';
import { PlanModule } from './plan/plan.module';
import { ReviewModule } from './review/review.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    // .env 전역 로드
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate Limiting — 기본 60회/분, 인증 엔드포인트는 @Throttle로 별도 제한
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    // TypeORM — DB 연결 설정은 .env에서만 관리
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('DB_HOST') || 'mysql.railway.internal';
        const port = config.get<number>('DB_PORT') || 3306;
        const username = config.get<string>('DB_USER') || 'root';
        const password = config.get<string>('DB_PASSWORD') || '';
        const database = config.get<string>('DB_NAME') || 'tripit';

        const missing = [
          'DB_HOST',
          'DB_PORT',
          'DB_USER',
          'DB_PASSWORD',
          'DB_NAME',
        ].filter((key) => !config.get(key));
        if (missing.length > 0) {
          console.warn(
            `[TypeORM] Missing env vars (using defaults): ${missing.join(', ')}`,
          );
        }

        console.log(
          `[TypeORM] Connecting to MySQL — host=${host} port=${port} user=${username} database=${database}`,
        );

        return {
          type: 'mysql',
          host,
          port,
          username,
          password,
          database,
          autoLoadEntities: true,
          // synchronize: true는 개발 중에만 사용 — 프로덕션에서는 migration으로 교체
          synchronize: false,
        };
      },
    }),

    // Mongoose — 채팅 메시지 전용 MongoDB 연결
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),

    CommonModule,
    AuthModule,
    UserModule,
    CityModule,
    PlanModule,
    CommunityModule,
    ReviewModule,
    ChatModule,
  ],
  providers: [
    // 전역 Rate Limit Guard — ThrottlerModule 설정 자동 적용
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
