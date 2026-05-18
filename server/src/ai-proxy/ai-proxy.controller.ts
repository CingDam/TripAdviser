import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AiProxyService } from './ai-proxy.service';
import { ChatRequest, GenerateRequest, SortRequest } from './dto/ai-proxy.dto';

interface AuthRequest {
  user: { userNum: number };
}

// 클라이언트는 이 컨트롤러를 통해서만 ai-server에 접근 — 직접 호출 차단
// rate limit: Nest JWT 사용자 기준 적용 — ai-server IP 기준은 Nest 서버 IP 하나로 수렴해 서비스 전체 공용 제한이 됨
@Controller('ai')
@UseGuards(AuthGuard('jwt'))
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  // 채팅 응답 생성 — Gemini 비용 보호, 사용자당 분당 20회
  @Post('chat')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  chat(@Body() dto: ChatRequest, @Req() req: AuthRequest) {
    return this.aiProxyService.forwardChat(dto, req.user.userNum);
  }

  // 일정 자동생성 — 비용이 크므로 사용자당 분당 5회로 강하게 제한
  @Post('generate')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  generate(@Body() dto: GenerateRequest, @Req() req: AuthRequest) {
    return this.aiProxyService.forwardGenerate(dto, req.user.userNum);
  }

  // 정렬 — 빠르고 저렴하나 남용 방지, 사용자당 분당 30회
  @Post('sort')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  sort(@Body() dto: SortRequest, @Req() req: AuthRequest) {
    return this.aiProxyService.forwardSort(dto, req.user.userNum);
  }
}
