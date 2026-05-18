import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ChatRequest, GenerateRequest, SortRequest } from './dto/ai-proxy.dto';

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly aiBaseUrl: string;
  private readonly internalSecret: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiBaseUrl =
      this.configService.get<string>('FASTAPI_URL') ?? 'http://localhost:8000';
    this.internalSecret =
      this.configService.get<string>('INTERNAL_SECRET') ?? '';
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      // ai-server 내부 인증 헤더 — INTERNAL_SECRET 미설정 시 개발 환경 폴백
      ...(this.internalSecret && { 'X-Internal-Secret': this.internalSecret }),
    };
  }

  async forwardChat(dto: ChatRequest, userNum: number): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<unknown>(`${this.aiBaseUrl}/api/chat`, dto, {
          headers: this.headers,
        }),
      );
      return response.data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`ai-server /chat 호출 실패 user:${userNum} — ${msg}`);
      throw new BadGatewayException('AI 서버 응답 실패');
    }
  }

  async forwardGenerate(
    dto: GenerateRequest,
    userNum: number,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<unknown>(`${this.aiBaseUrl}/api/generate`, dto, {
          headers: this.headers,
        }),
      );
      return response.data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `ai-server /generate 호출 실패 user:${userNum} — ${msg}`,
      );
      throw new BadGatewayException('AI 서버 응답 실패');
    }
  }

  async forwardSort(dto: SortRequest, userNum: number): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<unknown>(`${this.aiBaseUrl}/api/sort`, dto, {
          headers: this.headers,
        }),
      );
      return response.data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`ai-server /sort 호출 실패 user:${userNum} — ${msg}`);
      throw new BadGatewayException('AI 서버 응답 실패');
    }
  }
}
