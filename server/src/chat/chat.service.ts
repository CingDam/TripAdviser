import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';

const MESSAGE_PAGE_SIZE = 50;

interface SaveMessageParams {
  roomNum: number;
  userNum: number;
  senderName: string;
  senderProfile: string | null;
  content: string;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async saveMessage(params: SaveMessageParams): Promise<MessageDocument> {
    const message = new this.messageModel(params);
    return message.save();
  }

  // 페이지네이션 — before 기준으로 이전 메시지 50개 조회 (무한 스크롤)
  async getMessages(
    roomNum: number,
    before?: string,
  ): Promise<MessageDocument[]> {
    const query = this.messageModel.find({ roomNum });

    if (before) {
      query.where('_id').lt(before as unknown as number);
    }

    return query
      .sort({ createdAt: -1 })
      .limit(MESSAGE_PAGE_SIZE)
      .lean()
      .exec() as Promise<MessageDocument[]>;
  }
}
