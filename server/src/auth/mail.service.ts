import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: BrevoClient;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.getOrThrow<string>('BREVO_API_KEY');
    this.client = new BrevoClient({ apiKey });
    this.fromEmail = config.get<string>('MAIL_FROM') ?? 'noreply@planit.com';
    this.logger.log(`메일 설정 — from=${this.fromEmail} (Brevo HTTP API)`);
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    this.logger.log(`인증 메일 발송 시도 — to=${to}`);
    try {
      await this.client.transactionalEmails.sendTransacEmail({
        sender: { name: 'Planit', email: this.fromEmail },
        to: [{ email: to }],
        subject: '[Planit] 이메일 인증 코드',
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <h2 style="font-size:20px;font-weight:800;color:#1a1a1a;margin-bottom:8px;">
              Plan<span style="color:#4f46e5;">it</span> 이메일 인증
            </h2>
            <p style="color:#555;font-size:14px;margin-bottom:24px;">
              아래 인증 코드를 입력해 회원가입을 완료하세요.<br/>
              코드는 <strong>5분</strong> 후 만료됩니다.
            </p>
            <div style="background:#f4f4f8;border-radius:16px;padding:24px;text-align:center;letter-spacing:12px;font-size:32px;font-weight:800;color:#4f46e5;">
              ${code}
            </div>
            <p style="color:#aaa;font-size:12px;margin-top:24px;">
              본인이 요청하지 않은 경우 이 메일을 무시하세요.
            </p>
          </div>
        `,
      });
      this.logger.log(`인증 메일 발송 성공 — to=${to}`);
    } catch (err: unknown) {
      this.logger.error(`인증 메일 발송 실패 — to=${to}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('이메일 발송에 실패했습니다');
    }
  }
}
