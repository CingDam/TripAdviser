import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiProxyService } from './ai-proxy.service';
import { ChatRequest, GenerateRequest, SortRequest } from './dto/ai-proxy.dto';

interface AuthRequest {
  user: { userNum: number };
}

// 클라이언트는 이 컨트롤러를 통해서만 ai-server에 접근 — 직접 호출 차단
@Controller('ai')
@UseGuards(AuthGuard('jwt'))
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Post('chat')
  @HttpCode(200)
  chat(@Body() dto: ChatRequest, @Req() req: AuthRequest) {
    return this.aiProxyService.forwardChat(dto, req.user.userNum);
  }

  @Post('generate')
  @HttpCode(200)
  generate(@Body() dto: GenerateRequest, @Req() req: AuthRequest) {
    return this.aiProxyService.forwardGenerate(dto, req.user.userNum);
  }

  @Post('sort')
  @HttpCode(200)
  sort(@Body() dto: SortRequest, @Req() req: AuthRequest) {
    return this.aiProxyService.forwardSort(dto, req.user.userNum);
  }
}
