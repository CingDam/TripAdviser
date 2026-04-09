import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Community } from './entities/community.entity';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Community) private readonly communityRepo: Repository<Community>,
  ) {}

  findAll(): Promise<Community[]> {
    return this.communityRepo.find({
      relations: ['user', 'city'],
      order: { createdAt: 'DESC' },
    });
  }
}
