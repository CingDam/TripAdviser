import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Plan } from './plan.entity';

@Entity('tb_day_plan')
export class DayPlan {
  @PrimaryGeneratedColumn({ name: 'day_plan_num' })
  dayPlanNum: number;

  @ManyToOne(() => Plan, (plan) => plan.dayPlans, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_num' })
  plan: Plan;

  @Column({ name: 'plan_date', type: 'date' })
  planDate: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'place_id', type: 'varchar', length: 100, nullable: true })
  placeId: string | null;

  @Column({ name: 'location_name', type: 'varchar', length: 50, nullable: true })
  locationName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  address: string | null;

  @Column({ type: 'double', nullable: true })
  lat: number | null;

  @Column({ type: 'double', nullable: true })
  lng: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tel: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
