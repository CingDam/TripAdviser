import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// bcrypt salt round — 높을수록 안전하지만 느림, 10이 일반적인 균형점
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const exists = await this.userRepo.findOneBy({ id: dto.id });
    if (exists) throw new ConflictException('이미 사용 중인 아이디입니다');

    const hashed = await bcrypt.hash(dto.pw, BCRYPT_SALT_ROUNDS);
    const user = this.userRepo.create({ name: dto.name, id: dto.id, pw: hashed });
    const saved = await this.userRepo.save(user);

    return { accessToken: this.sign(saved) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.userRepo.findOneBy({ id: dto.id });
    if (!user) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다');

    const valid = await bcrypt.compare(dto.pw, user.pw);
    if (!valid) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다');

    return { accessToken: this.sign(user) };
  }

  private sign(user: User): string {
    return this.jwtService.sign({ sub: user.userNum, id: user.id });
  }
}
