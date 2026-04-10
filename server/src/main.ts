import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Next.js 클라이언트(3000) 요청 허용
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });

  // DTO 자동 검증 — class-validator 데코레이터 활성화
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
void bootstrap();
