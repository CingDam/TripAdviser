import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Community } from './entities/community.entity';
import { Comment } from './entities/comment.entity';
import { CommunityLike } from './entities/community-like.entity';
import { CommunityImage } from './entities/community-image.entity';
import { Report } from './entities/report.entity';
import { Plan } from '../plan/entities/plan.entity';
import { DayPlan } from '../plan/entities/day-plan.entity';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { NotificationModule } from '../notification/notification.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    // Plan·DayPlan은 일정 첨부 검증·복제에 사용 — 같은 Repository 토큰 공유
    TypeOrmModule.forFeature([
      Community,
      Comment,
      CommunityLike,
      CommunityImage,
      Report,
      Plan,
      DayPlan,
    ]),
    NotificationModule,
    CommonModule,
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
