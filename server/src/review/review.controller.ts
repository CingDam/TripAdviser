import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';

interface AuthRequest {
  user: { userNum: number };
}

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // GET /api/review?placeId=xxx — 장소별 리뷰 목록
  @Get()
  findByPlace(@Query('placeId') placeId?: string) {
    if (placeId) return this.reviewService.findByPlace(placeId);
    return this.reviewService.findAll();
  }

  // POST /api/review — 리뷰 작성
  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req: AuthRequest, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(req.user.userNum, dto);
  }

  // DELETE /api/review/:id — 리뷰 삭제 (본인만)
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
  ) {
    return this.reviewService.remove(id, req.user.userNum);
  }

  // POST /api/review/:id/like — 좋아요 토글
  @Post(':id/like')
  @UseGuards(AuthGuard('jwt'))
  toggleLike(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
  ) {
    return this.reviewService.toggleLike(id, req.user.userNum);
  }
}
