import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CLIENT_URL 없으면 로컬 개발 폴백 — Railway 배포 시 환경변수로 주입
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';
  app.enableCors({ origin: clientUrl, credentials: true });

  // DTO 자동 검증 — class-validator 데코레이터 활성화
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix('api');

  // 업로드 폴더 없으면 자동 생성
  mkdirSync(join(process.cwd(), 'uploads', 'community'), { recursive: true });

  // /uploads/* 경로로 업로드 파일 정적 서빙
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
void bootstrap();
