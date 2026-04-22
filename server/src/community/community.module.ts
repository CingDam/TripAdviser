import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Community } from './entities/community.entity';
import { Comment } from './entities/comment.entity';
import { CommunityLike } from './entities/community-like.entity';
import { CommunityImage } from './entities/community-image.entity';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Community,
      Comment,
      CommunityLike,
      CommunityImage,
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
