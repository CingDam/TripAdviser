import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
  ) {}

  findAll(): Promise<Review[]> {
    return this.reviewRepo.find({
      relations: ['user', 'city'],
      order: { createdAt: 'DESC' },
    });
  }
}
