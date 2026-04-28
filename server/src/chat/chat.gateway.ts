import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

interface JwtPayload {
  sub: number;
  email: string;
  name: string;
}

interface AuthenticatedSocket extends Socket {
  userNum: number;
  userName: string;
  userProfile: string | null;
}

interface JoinRoomPayload {
  roomNum: number;
  senderProfile: string | null;
}

interface SendMessagePayload {
  roomNum: number;
  content: string;
}

@WebSocketGateway({
  cors: {
    // CLIENT_URL 미설정 시 개발 환경 폴백 — Railway 배포 시 환경변수로 주입
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // 연결 시점에 handshake 토큰 검증 — 실패하면 소켓 강제 종료
  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as Record<string, string>).token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) throw new UnauthorizedException('토큰 없음');

      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      // 검증된 사용자 정보를 소켓에 부착 — 이후 이벤트에서 클라이언트 전송값 대신 사용
      const authed = client as AuthenticatedSocket;
      authed.userNum = payload.sub;
      authed.userName = payload.name;
      authed.userProfile = null;

      this.logger.log(`클라이언트 연결: ${client.id} (user:${payload.sub})`);
    } catch {
      this.logger.warn(`인증 실패 — 소켓 종료: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`클라이언트 연결 해제: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const authed = client as AuthenticatedSocket;
    if (!authed.userNum) return;

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
  async handleMessage(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const authed = client as AuthenticatedSocket;
    if (!authed.userNum) return;

    // 클라이언트 전송 userNum 대신 JWT에서 검증된 값을 사용
    const message = await this.chatService.saveMessage({
      roomNum: payload.roomNum,
      userNum: authed.userNum,
      senderName: authed.userName,
      senderProfile: authed.userProfile,
      content: payload.content,
    });
    this.server.to(`room:${payload.roomNum}`).emit('newMessage', message);
  }
}
