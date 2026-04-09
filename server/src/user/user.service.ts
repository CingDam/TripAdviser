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
    const { pw: _, ...rest } = user;
    return rest;
  }
}
