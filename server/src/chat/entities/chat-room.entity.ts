import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatRoomMember } from './chat-room-member.entity';

@Entity('tb_chat_room')
export class ChatRoom {
  @PrimaryGeneratedColumn({ name: 'room_num' })
  roomNum!: number;

  @Column({ name: 'room_name', type: 'varchar', length: 100, nullable: true })
  roomName!: string | null;

  @Column({
    name: 'room_type',
    type: 'enum',
    enum: ['private', 'open'],
    default: 'open',
  })
  roomType!: 'private' | 'open';

  // 도시별 채팅방 분류를 위해 city_num 컬럼 추가 — DB synchronize: false이므로 마이그레이션 필요
  @Column({ name: 'city_num', type: 'int', nullable: true })
  cityNum!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => ChatRoomMember, (member) => member.room)
  members!: ChatRoomMember[];
}
