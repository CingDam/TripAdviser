import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AiProxyService } from './ai-proxy.service';
import { ChatRequest, GenerateRequest, SortRequest } from './dto/ai-proxy.dto';

// 클라이언트는 이 컨트롤러를 통해서만 ai-server에 접근 — 직접 호출 차단
// JWT 가드 없음: plan 페이지는 비로그인자도 사용 가능, Throttler로 IP 기준 남용 방지
@Controller('ai')
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  // 채팅 응답 생성 — Gemini 비용 보호, IP당 분당 20회
  @Post('chat')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  chat(@Body() dto: ChatRequest) {
    return this.aiProxyService.forwardChat(dto);
  }

  // 채팅 SSE 스트리밍 — ai-server SSE를 그대로 클라이언트에 파이프
  @Post('chat/stream')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async chatStream(
    @Body() dto: ChatRequest,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    await this.aiProxyService.pipeStreamChat(dto, res);
  }

  // 일정 자동생성 — 비용이 크므로 IP당 분당 5회로 강하게 제한
  @Post('generate')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  generate(@Body() dto: GenerateRequest) {
    return this.aiProxyService.forwardGenerate(dto);
  }

  // 정렬 — 빠르고 저렴하나 남용 방지, IP당 분당 30회
  @Post('sort')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  sort(@Body() dto: SortRequest) {
    return this.aiProxyService.forwardSort(dto);
  }
}
