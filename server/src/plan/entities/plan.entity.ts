import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { City } from '../../city/entities/city.entity';
import { DayPlan } from './day-plan.entity';

@Entity('tb_plan')
export class Plan {
  @PrimaryGeneratedColumn({ name: 'plan_num' })
  planNum: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user: User;

  @ManyToOne(() => City, { onDelete: 'SET NULL', onUpdate: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'city_num' })
  city: City | null;

  @Column({ name: 'plan_name', length: 45 })
  planName: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  // 0=비공개, 1=공개
  @Column({ name: 'is_public', type: 'tinyint', default: 0 })
  isPublic: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => DayPlan, (dp) => dp.plan)
  dayPlans: DayPlan[];
}
