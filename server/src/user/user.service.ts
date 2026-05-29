import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

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

  async update(
    userNum: number,
    dto: UpdateUserDto,
    profileImg?: string,
  ): Promise<Omit<User, 'pw'>> {
    const user = await this.userRepo.findOneBy({ userNum });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');

    if (dto.name !== undefined && dto.name !== user.name) {
      // 본인을 제외하고 같은 닉네임이 있으면 거부
      const taken = await this.userRepo.findOneBy({
        name: dto.name,
        userNum: Not(userNum),
      });
      if (taken) throw new ConflictException('이미 사용 중인 닉네임입니다');
      user.name = dto.name;
    }
    if (profileImg !== undefined) user.profileImg = profileImg;

    await this.userRepo.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pw, ...rest } = user;
    return rest;
  }
}
