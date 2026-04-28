import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoomController } from './chat-room.controller';
import { ChatRoomService } from './chat-room.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatRoomMember } from './entities/chat-room-member.entity';
import { ChatRoom } from './entities/chat-room.entity';
import { Message, MessageSchema } from './schemas/message.schema';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, ChatRoomMember]),
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ChatRoomController],
  providers: [ChatGateway, ChatService, ChatRoomService],
})
export class ChatModule {}
