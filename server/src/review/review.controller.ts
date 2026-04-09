import { Controller, Get } from '@nestjs/common';
import { ReviewService } from './review.service';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // GET /api/review
  @Get()
  findAll() {
    return this.reviewService.findAll();
  }
}
