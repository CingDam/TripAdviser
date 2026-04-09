import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { City } from '../../city/entities/city.entity';

@Entity('tb_review')
export class Review {
  @PrimaryGeneratedColumn({ name: 'review_num' })
  reviewNum: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user: User;

  @ManyToOne(() => City, { onDelete: 'SET NULL', onUpdate: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'city_num' })
  city: City | null;

  @Column({ name: 'place_id', type: 'varchar', length: 100, nullable: true })
  placeId: string | null;

  @Column({ name: 'location_name', type: 'varchar', length: 50, nullable: true })
  locationName: string | null;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
