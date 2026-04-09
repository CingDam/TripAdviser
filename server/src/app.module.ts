import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CityModule } from './city/city.module';
import { PlanModule } from './plan/plan.module';
import { CommunityModule } from './community/community.module';
import { ReviewModule } from './review/review.module';

@Module({
  imports: [
    // .env 전역 로드
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM — DB 연결 설정은 .env에서만 관리
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        // synchronize: true는 개발 중에만 사용 — 프로덕션에서는 migration으로 교체
        synchronize: false,
      }),
    }),

    AuthModule,
    UserModule,
    CityModule,
    PlanModule,
    CommunityModule,
    ReviewModule,
  ],
})
export class AppModule {}
