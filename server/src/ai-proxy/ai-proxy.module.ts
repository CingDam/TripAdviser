import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiProxyController } from './ai-proxy.controller';
import { AiProxyService } from './ai-proxy.service';

@Module({
  imports: [
    // ai-server HTTP 호출용 — 타임아웃 30초 (Gemini 응답 지연 대비)
    HttpModule.register({ timeout: 30_000 }),
  ],
  controllers: [AiProxyController],
  providers: [AiProxyService],
})
export class AiProxyModule {}
