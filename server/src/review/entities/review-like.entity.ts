import {
  CreateDateColumn, Entity, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Review } from './review.entity';

// uq_review_like — 사용자당 리뷰 좋아요 1회 제한
@Entity('tb_review_like')
@Unique(['review', 'user'])
export class ReviewLike {
  @PrimaryGeneratedColumn({ name: 'like_num' })
  likeNum: number;

  @ManyToOne(() => Review, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'review_num' })
  review: Review;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
