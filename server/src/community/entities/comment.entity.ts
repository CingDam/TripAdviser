import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Community } from './community.entity';

@Entity('tb_comment')
export class Comment {
  @PrimaryGeneratedColumn({ name: 'comment_num' })
  commentNum: number;

  @ManyToOne(() => Community, (c) => c.comments, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'community_num' })
  community: Community;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user: User;

  // NULL이면 최상위 댓글, 값이 있으면 대댓글
  @ManyToOne(() => Comment, (c) => c.replies, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_comment_num' })
  parent: Comment | null;

  @OneToMany(() => Comment, (c) => c.parent)
  replies: Comment[];

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
