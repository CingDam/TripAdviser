import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { City } from '../../city/entities/city.entity';
import { Comment } from './comment.entity';

@Entity('tb_community')
export class Community {
  @PrimaryGeneratedColumn({ name: 'community_num' })
  communityNum: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user: User;

  @ManyToOne(() => City, { onDelete: 'SET NULL', onUpdate: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'city_num' })
  city: City | null;

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
}
