import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
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

    // Mongoose — 채팅 메시지 전용 MongoDB 연결
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),

    AuthModule,
    UserModule,
    CityModule,
    PlanModule,
    CommunityModule,
    ReviewModule,
    ChatModule,
  ],
})
export class AppModule {}
