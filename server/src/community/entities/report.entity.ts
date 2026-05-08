import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Community } from './community.entity';
import { Comment } from './comment.entity';

@Entity('tb_report')
@Index('uq_report', ['reporter', 'community', 'comment'], { unique: true })
export class Report {
  @PrimaryGeneratedColumn({ name: 'report_num' })
  reportNum: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_num' })
  reporter: User;

  // 게시글 신고 시 설정, 댓글 신고 시 null
  @ManyToOne(() => Community, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_num' })
  community: Community | null;

  // 댓글 신고 시 설정, 게시글 신고 시 null
  @ManyToOne(() => Comment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_num' })
  comment: Comment | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
