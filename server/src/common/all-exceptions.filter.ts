import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : '알 수 없는 서버 오류';

    if (status >= 500) {
      // 5xx — 스택 트레이스까지 출력해 원인 파악
      this.logger.error(
        `${req.method} ${req.originalUrl} ${status} — ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      // 4xx — 한 줄 warn (스팸 방지)
      this.logger.warn(
        `${req.method} ${req.originalUrl} ${status} — ${message}`,
      );
    }

    res.status(status).json({
      statusCode: status,
      message,
      path: req.originalUrl,
    });
  }
}
