import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Community } from './entities/community.entity';
import { Comment } from './entities/comment.entity';
import { CommunityLike } from './entities/community-like.entity';
import { CommunityImage } from './entities/community-image.entity';
import { Plan } from '../plan/entities/plan.entity';
import { DayPlan } from '../plan/entities/day-plan.entity';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [
    // Plan·DayPlan은 일정 첨부 검증·복제에 사용 — 같은 Repository 토큰 공유
    TypeOrmModule.forFeature([
      Community,
      Comment,
      CommunityLike,
      CommunityImage,
      Plan,
      DayPlan,
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
