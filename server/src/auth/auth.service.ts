import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities/user.entity';
import { SocialLogin, SocialProvider } from './entities/social-login.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from './mail.service';

export interface SocialProfile {
  provider: SocialProvider;
  providerId: string;
  email: string | null;
  name: string;
  profileImg: string | null;
}

// bcrypt salt round — 높을수록 안전하지만 느림, 10이 일반적인 균형점
const BCRYPT_SALT_ROUNDS = 10;

// 인증코드 만료 시간 (ms)
const CODE_TTL_MS = 5 * 60 * 1000;

// 소셜 연동 코드 만료 시간 (ms)
const LINK_CODE_TTL_MS = 5 * 60 * 1000;

interface VerificationEntry {
  code: string;
  expiresAt: Date;
  verified: boolean;
}

interface LinkCodeEntry {
  userNum: number;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  // 인증코드 임시 저장소 — 서버 재시작 시 초기화됨 (프로덕션에서는 Redis로 교체)
  private readonly verificationMap = new Map<string, VerificationEntry>();

  // 소셜 연동 코드 임시 저장소
  private readonly linkCodeMap = new Map<string, LinkCodeEntry>();

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(SocialLogin)
    private readonly socialRepo: Repository<SocialLogin>,
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

  async socialLogin(profile: SocialProfile): Promise<{ accessToken: string }> {
    // 기존 소셜 연동 확인
    const existing = await this.socialRepo.findOne({
      where: { provider: profile.provider, providerId: profile.providerId },
      relations: ['user'],
    });
    if (existing) return { accessToken: this.sign(existing.user) };

    // 동일 이메일 계정이 있으면 소셜 연동 추가, 없으면 신규 가입
    let user: User;
    if (profile.email) {
      const byEmail = await this.userRepo.findOneBy({ email: profile.email });
      if (byEmail) {
        user = byEmail;
      } else {
        user = await this.userRepo.save(
          this.userRepo.create({
            name: profile.name,
            email: profile.email,
            pw: null,
            profileImg: profile.profileImg,
            isVerified: true,
          }),
        );
      }
    } else {
      user = await this.userRepo.save(
        this.userRepo.create({
          name: profile.name,
          email: null,
          pw: null,
          profileImg: profile.profileImg,
          isVerified: true,
        }),
      );
    }

    await this.socialRepo.save(
      this.socialRepo.create({
        user,
        provider: profile.provider,
        providerId: profile.providerId,
      }),
    );

    return { accessToken: this.sign(user) };
  }

  // ── 소셜 연동 코드 ──────────────────────────────────────────

  generateLinkCode(userNum: number): string {
    const code = randomBytes(16).toString('hex');
    this.linkCodeMap.set(code, {
      userNum,
      expiresAt: new Date(Date.now() + LINK_CODE_TTL_MS),
    });
    return code;
  }

  isValidLinkCode(code: string): boolean {
    const entry = this.linkCodeMap.get(code);
    if (!entry) return false;
    if (new Date() > entry.expiresAt) {
      this.linkCodeMap.delete(code);
      return false;
    }
    return true;
  }

  async linkSocial(code: string, profile: SocialProfile): Promise<void> {
    const entry = this.linkCodeMap.get(code);
    if (!entry || new Date() > entry.expiresAt) {
      throw new BadRequestException(
        '연동 코드가 만료되었습니다. 다시 시도해 주세요',
      );
    }
    this.linkCodeMap.delete(code);

    // 이미 다른 계정에 연동된 소셜 ID인지 확인
    const existingBySocial = await this.socialRepo.findOne({
      where: { provider: profile.provider, providerId: profile.providerId },
    });
    if (existingBySocial)
      throw new ConflictException('이미 다른 계정에 연동된 소셜 계정입니다');

    // 해당 유저에 같은 provider가 이미 연동됐는지 확인
    const alreadyLinked = await this.socialRepo.findOne({
      where: { user: { userNum: entry.userNum }, provider: profile.provider },
    });
    if (alreadyLinked)
      throw new ConflictException('이미 연동된 소셜 계정입니다');

    const user = await this.userRepo.findOneBy({ userNum: entry.userNum });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다');

    await this.socialRepo.save(
      this.socialRepo.create({
        user,
        provider: profile.provider,
        providerId: profile.providerId,
      }),
    );
  }

  async getSocialLinks(
    userNum: number,
  ): Promise<{ provider: SocialProvider; createdAt: Date }[]> {
    const links = await this.socialRepo.find({
      where: { user: { userNum } },
      order: { createdAt: 'ASC' },
    });
    return links.map((l) => ({ provider: l.provider, createdAt: l.createdAt }));
  }

  async unlinkSocial(userNum: number, provider: SocialProvider): Promise<void> {
    const user = await this.userRepo.findOneBy({ userNum });
    const links = await this.socialRepo.find({ where: { user: { userNum } } });

    // 비밀번호도 없고 소셜 연동이 1개뿐이면 마지막 로그인 수단이므로 해제 불가
    if (!user?.pw && links.length <= 1) {
      throw new BadRequestException('마지막 로그인 수단은 해제할 수 없습니다');
    }

    await this.socialRepo.delete({ user: { userNum } as User, provider });
  }

  private sign(user: User): string {
    return this.jwtService.sign({
      sub: user.userNum,
      email: user.email,
      name: user.name,
    });
  }
}
