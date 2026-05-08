import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { City } from '../../city/entities/city.entity';
import { Plan } from '../../plan/entities/plan.entity';
import { Comment } from './comment.entity';
import { CommunityImage } from './community-image.entity';
import { CommunityLike } from './community-like.entity';

@Entity('tb_community')
export class Community {
  @PrimaryGeneratedColumn({ name: 'community_num' })
  communityNum: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user: User;

  @ManyToOne(() => City, {
    onDelete: 'SET NULL',
    onUpdate: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'city_num' })
  city: City | null;

  // 게시글에 첨부된 일정 — 작성자 본인 소유의 plan만 첨부 가능
  // 원본 plan이 삭제되면 게시글의 첨부만 끊고(SET NULL) 게시글은 유지
  @ManyToOne(() => Plan, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'plan_num' })
  plan: Plan | null;

  @Column({ length: 100 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Comment, (c) => c.community)
  comments: Comment[];

  @OneToMany(() => CommunityImage, (img) => img.community)
  images: CommunityImage[];

  @OneToMany(() => CommunityLike, (l) => l.community)
  likes: CommunityLike[];
}
