import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from './mail.service';

// bcrypt salt round — 높을수록 안전하지만 느림, 10이 일반적인 균형점
const BCRYPT_SALT_ROUNDS = 10;

// 인증코드 만료 시간 (ms)
const CODE_TTL_MS = 5 * 60 * 1000;

interface VerificationEntry {
  code: string;
  expiresAt: Date;
  verified: boolean;
}

@Injectable()
export class AuthService {
  // 인증코드 임시 저장소 — 서버 재시작 시 초기화됨 (프로덕션에서는 Redis로 교체)
  private readonly verificationMap = new Map<string, VerificationEntry>();

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async sendVerification(email: string): Promise<void> {
    const exists = await this.userRepo.findOneBy({ email });
    if (exists) throw new ConflictException('이미 가입된 이메일입니다');

    // 6자리 랜덤 숫자 코드
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.verificationMap.set(email, {
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      verified: false,
    });

    await this.mailService.sendVerificationCode(email, code);
  }

  verifyCode(email: string, code: string): void {
    const entry = this.verificationMap.get(email);
    if (!entry) throw new BadRequestException('인증코드를 먼저 요청해 주세요');
    if (new Date() > entry.expiresAt) {
      this.verificationMap.delete(email);
      throw new BadRequestException(
        '인증코드가 만료되었습니다. 다시 요청해 주세요',
      );
    }
    if (entry.code !== code)
      throw new BadRequestException('인증코드가 올바르지 않습니다');

    entry.verified = true;
  }

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const entry = this.verificationMap.get(dto.email);
    if (!entry?.verified) {
      throw new BadRequestException('이메일 인증을 먼저 완료해 주세요');
    }

    const exists = await this.userRepo.findOneBy({ email: dto.email });
    if (exists) throw new ConflictException('이미 가입된 이메일입니다');

    const hashed = await bcrypt.hash(dto.pw, BCRYPT_SALT_ROUNDS);
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      pw: hashed,
      // 이메일 인증 완료 후 가입이므로 즉시 verified 처리
      isVerified: true,
    });
    const saved = await this.userRepo.save(user);

    // 가입 완료 후 인증 항목 제거
    this.verificationMap.delete(dto.email);

    return { accessToken: this.sign(saved) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.userRepo.findOneBy({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다',
      );
    }

    // 소셜 로그인 전용 계정은 pw가 null — 일반 로그인 불가
    if (!user.pw) {
      throw new UnauthorizedException('소셜 로그인으로 가입된 계정입니다');
    }

    const valid = await bcrypt.compare(dto.pw, user.pw);
    if (!valid) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다',
      );
    }

    return { accessToken: this.sign(user) };
  }

  private sign(user: User): string {
    return this.jwtService.sign({
      sub: user.userNum,
      email: user.email,
      name: user.name,
    });
  }
}
