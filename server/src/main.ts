import { webcrypto } from 'crypto';
import { setDefaultResultOrder } from 'dns';

// Node.js 18 이하에서 globalThis.crypto가 없어 TypeORM이 크래시하는 문제 방지
if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto =
    webcrypto as unknown as Crypto;
}

// Railway 환경에서 IPv6 DNS 응답을 우선 사용해 SMTP 등 외부 연결이 ENETUNREACH로 실패하는 문제 방지
setDefaultResultOrder('ipv4first');

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
