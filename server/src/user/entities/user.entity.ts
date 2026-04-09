import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tb_user')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_num' })
  userNum: number;

  @Column({ length: 15 })
  name: string;

  @Column({ unique: true, length: 45 })
  id: string;

  @Column({ length: 255 })
  pw: string;

  @Column({ name: 'profile_img', type: 'varchar', length: 255, nullable: true })
  profileImg: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
