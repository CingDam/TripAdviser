import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { ReviewLike } from './entities/review-like.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(ReviewLike)
    private readonly likeRepo: Repository<ReviewLike>,
  ) {}

  // placeId 기준 리뷰 목록 조회 — 장소 상세 패널에서 호출
  findByPlace(placeId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { placeId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  findAll(): Promise<Review[]> {
    return this.reviewRepo.find({
      relations: ['user', 'city'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(userNum: number, dto: CreateReviewDto): Promise<Review> {
    const review = this.reviewRepo.create({
      user: { userNum },
      ...(dto.cityNum && { city: { cityNum: dto.cityNum } }),
      placeId: dto.placeId ?? null,
      locationName: dto.locationName ?? null,
      rating: dto.rating,
      content: dto.content ?? null,
    });
    return this.reviewRepo.save(review);
  }

  async remove(reviewNum: number, userNum: number): Promise<void> {
    const review = await this.reviewRepo.findOne({
      where: { reviewNum },
      relations: ['user'],
    });
    if (!review) throw new NotFoundException('리뷰를 찾을 수 없습니다');
    if (review.user.userNum !== userNum)
      throw new ForbiddenException('삭제 권한이 없습니다');
    await this.reviewRepo.remove(review);
  }

  async toggleLike(
    reviewNum: number,
    userNum: number,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const existing = await this.likeRepo.findOne({
      where: { review: { reviewNum }, user: { userNum } },
    });

    if (existing) {
      await this.likeRepo.remove(existing);
    } else {
      await this.likeRepo.save(
        this.likeRepo.create({ review: { reviewNum }, user: { userNum } }),
      );
    }

    const likeCount = await this.likeRepo.count({
      where: { review: { reviewNum } },
    });
    return { liked: !existing, likeCount };
  }
}
