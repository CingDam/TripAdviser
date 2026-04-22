import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true })
  roomNum: number; // MySQL tb_chat_room의 room_num

  @Prop({ required: true })
  userNum: number;

  @Prop({ required: true })
  senderName: string;

  @Prop({ type: String, default: null })
  senderProfile: string | null;

  @Prop({ required: true })
  content: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// 채팅방별 시간순 조회 성능을 위한 복합 인덱스
MessageSchema.index({ roomNum: 1, createdAt: -1 });
