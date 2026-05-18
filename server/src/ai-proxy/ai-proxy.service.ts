import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Response } from 'express';
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

    // 프로덕션에서 INTERNAL_SECRET 미설정 시 서버 시작 거부 — env 누락으로 ai-server가 공개되는 사고 방지
    if (process.env.NODE_ENV === 'production' && !this.internalSecret) {
      throw new Error('INTERNAL_SECRET must be set in production environment');
    }
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

  async pipeStreamChat(
    dto: ChatRequest,
    userNum: number,
    res: Response,
  ): Promise<void> {
    // ai-server SSE 스트림을 Node.js IncomingMessage로 받아 클라이언트에 파이프
    try {
      const response = await firstValueFrom(
        this.httpService.post<NodeJS.ReadableStream>(
          `${this.aiBaseUrl}/api/chat/stream`,
          dto,
          {
            headers: this.headers,
            responseType: 'stream',
          },
        ),
      );
      await new Promise<void>((resolve, reject) => {
        response.data.pipe(res, { end: true });
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`ai-server /chat/stream 실패 user:${userNum} — ${msg}`);
      if (!res.headersSent) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: 'AI 서버 응답 실패' })}\n\n`,
        );
      }
      res.end();
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
