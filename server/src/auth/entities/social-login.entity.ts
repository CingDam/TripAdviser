import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export type SocialProvider = 'google' | 'kakao' | 'naver';

@Entity('tb_social_login')
export class SocialLogin {
  @PrimaryGeneratedColumn({ name: 'social_num' })
  socialNum: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user: User;

  @Column({ type: 'enum', enum: ['google', 'kakao', 'naver'] })
  provider: SocialProvider;

  @Column({ name: 'provider_id', length: 255 })
  providerId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
