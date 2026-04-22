import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

interface JoinRoomPayload {
  roomNum: number;
  userNum: number;
  senderName: string;
  senderProfile: string | null;
}

interface SendMessagePayload {
  roomNum: number;
  userNum: number;
  senderName: string;
  senderProfile: string | null;
  content: string;
}

@WebSocketGateway({
  cors: {
    // CLIENT_URL 미설정 시 개발 편의상 전체 허용 — 프로덕션에서는 반드시 명시
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`클라이언트 연결: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`클라이언트 연결 해제: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const roomKey = `room:${payload.roomNum}`;
    await client.join(roomKey);

    // 입장 시 최근 메시지 50개 전송
    const history = await this.chatService.getMessages(payload.roomNum);
    client.emit('messageHistory', history.reverse());
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() payload: { roomNum: number },
    @ConnectedSocket() client: Socket,
  ) {
    await client.leave(`room:${payload.roomNum}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(@MessageBody() payload: SendMessagePayload) {
    const message = await this.chatService.saveMessage(payload);
    this.server.to(`room:${payload.roomNum}`).emit('newMessage', message);
  }
}
