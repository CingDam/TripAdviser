import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async findOne(userNum: number): Promise<Omit<User, 'pw'>> {
    const user = await this.userRepo.findOneBy({ userNum });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    // pw는 의도적으로 제외 — 응답에 비밀번호 노출 방지
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pw, ...rest } = user;
    return rest;
  }
}
