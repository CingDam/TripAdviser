import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ChatRoom } from './chat-room.entity';

@Entity('tb_chat_room_member')
export class ChatRoomMember {
  @PrimaryGeneratedColumn({ name: 'member_num' })
  memberNum!: number;

  @ManyToOne(() => ChatRoom, (room) => room.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_num' })
  room!: ChatRoom;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user!: User;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt!: Date;
}
