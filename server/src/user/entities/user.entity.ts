import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('tb_user')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_num' })
  userNum!: number;

  @Column({ length: 15 })
  name!: string;

  // 소셜 로그인 전용 계정은 이메일 없을 수 있어 nullable
  // unique: true — MySQL에서 NULL은 중복으로 취급하지 않으므로 소셜 계정 여러 개 허용
  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  email!: string | null;

  // 소셜 로그인 전용 계정은 비밀번호 없음
  @Column({ type: 'varchar', length: 255, nullable: true })
  pw!: string | null;

  @Column({ name: 'profile_img', type: 'varchar', length: 255, nullable: true })
  profileImg!: string | null;

  // 이메일 인증 여부 — 이메일 회원가입 완료 시 true로 설정
  @Column({ name: 'is_verified', default: false })
  isVerified!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
