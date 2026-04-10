import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('tb_city')
export class City {
  @PrimaryGeneratedColumn({ name: 'city_num' })
  cityNum: number;

  @Column({ name: 'city_name', length: 50 })
  cityName: string;

  @Column({ length: 50 })
  country: string;

  @Column({ type: 'double' })
  lat: number;

  @Column({ type: 'double' })
  lng: number;

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'plan_count', default: 0 })
  planCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
