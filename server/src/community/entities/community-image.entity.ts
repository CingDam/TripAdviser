import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Community } from './community.entity';

@Entity('tb_community_image')
export class CommunityImage {
  @PrimaryGeneratedColumn({ name: 'image_num' })
  imageNum: number;

  @ManyToOne(() => Community, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'community_num' })
  community: Community;

  @Column({ name: 'image_url', type: 'varchar', length: 255 })
  imageUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
