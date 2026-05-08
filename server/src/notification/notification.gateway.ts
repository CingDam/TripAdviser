import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

export interface NotificationPayload {
  type: 'comment' | 'like';
  communityNum: number;
  communityTitle: string;
  actorName: string;
}

interface JwtPayload {
  sub: number;
  email: string;
  name: string;
}

interface AuthenticatedSocket extends Socket {
  userNum: number;
}

// 채팅과 포트를 공유하되 namespace로 분리 — 클라이언트가 /notification으로 연결
@WebSocketGateway({
  namespace: '/notification',
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as Record<string, string>).token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) throw new UnauthorizedException('토큰 없음');

      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      (client as AuthenticatedSocket).userNum = payload.sub;
      // 사용자별 room에 자동 입장 — 알림을 특정 사용자에게만 전달하기 위해
      void client.join(`user:${payload.sub}`);

      this.logger.log(`알림 연결: ${client.id} (user:${payload.sub})`);
    } catch {
      this.logger.warn(`알림 인증 실패 — 소켓 종료: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`알림 연결 해제: ${client.id}`);
  }

  // 특정 사용자에게 알림 전송 — CommunityService에서 호출
  sendToUser(userNum: number, payload: NotificationPayload) {
    this.server.to(`user:${userNum}`).emit('notification', payload);
  }
}
