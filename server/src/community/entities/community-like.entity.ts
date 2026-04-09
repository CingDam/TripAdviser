import {
  CreateDateColumn, Entity, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Community } from './community.entity';

// uq_community_like — 사용자당 게시글 좋아요 1회 제한
@Entity('tb_community_like')
@Unique(['community', 'user'])
export class CommunityLike {
  @PrimaryGeneratedColumn({ name: 'like_num' })
  likeNum: number;

  @ManyToOne(() => Community, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'community_num' })
  community: Community;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
