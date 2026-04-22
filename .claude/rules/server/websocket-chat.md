# WebSocket 채팅 규칙 (NestJS + MongoDB)

## 아키텍처

채팅방 메타(생성·멤버)는 MySQL(TypeORM), 채팅 메시지는 MongoDB(Mongoose)로 분리한다.

```
실시간 통신    NestJS + Socket.IO (WebSocket)
채팅방 메타    MySQL — tb_chat_room, tb_chat_room_member (기존 유지)
채팅 기록      MongoDB Atlas — chat_messages 컬렉션
브로커         없음 (서버 1대 기준 — 스케일아웃 시 Redis 추가)
```

## 모듈 구조

```
src/chat/
├── chat.module.ts
├── chat.gateway.ts       WebSocket 이벤트 수신·발신
├── chat.service.ts       메시지 저장·조회 비즈니스 로직
└── schemas/
    └── message.schema.ts  Mongoose 스키마
```

## Mongoose 스키마 규칙

- 메시지 도큐먼트는 `roomNum`(MySQL FK), `userNum`, `content`, `createdAt`을 포함한다
- `_id`는 MongoDB ObjectId 그대로 사용 (별도 PK 불필요)
- 시간순 조회를 위해 `createdAt`에 인덱스를 건다

```typescript
@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true })
  roomNum: number; // MySQL tb_chat_room의 FK

  @Prop({ required: true })
  userNum: number;

  @Prop({ required: true })
  content: string;
}
```

## Gateway 규칙

- Gateway는 이벤트 수신·발신만 담당한다. 로직은 Service에 위임한다
- 클라이언트는 `roomNum` 기준으로 room에 join한다
- JWT 검증은 `@UseGuards` 또는 `handleConnection`에서 처리한다

```typescript
// X — Gateway에 직접 로직
@SubscribeMessage('sendMessage')
async handleMessage(@MessageBody() data: unknown) {
  await this.messageRepo.save({ ...data }); // DB 직접 접근 금지
}

// O — Service에 위임
@SubscribeMessage('sendMessage')
async handleMessage(@MessageBody() dto: SendMessageDto) {
  const message = await this.chatService.saveMessage(dto);
  this.server.to(`room:${dto.roomNum}`).emit('newMessage', message);
}
```

## 이벤트 네이밍 규칙

| 방향 | 이벤트명 | 설명 |
|---|---|---|
| 클라이언트 → 서버 | `joinRoom` | 채팅방 입장 |
| 클라이언트 → 서버 | `leaveRoom` | 채팅방 퇴장 |
| 클라이언트 → 서버 | `sendMessage` | 메시지 전송 |
| 서버 → 클라이언트 | `newMessage` | 새 메시지 수신 |
| 서버 → 클라이언트 | `messageHistory` | 이전 메시지 목록 |

## 환경변수

```env
MONGODB_URI=mongodb+srv://{user}:{password}@{host}/{dbname}?appName={appName}
```

`ConfigService`를 통해서만 접근한다. `process.env` 직접 접근 금지.

## app.module.ts 연결

```typescript
MongooseModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    uri: config.get<string>('MONGODB_URI'),
  }),
}),
```

## CORS

Socket.IO는 별도 CORS 설정이 필요하다. `main.ts`의 `IoAdapter` 또는 Gateway의 `@WebSocketGateway` 옵션에 명시한다.

```typescript
@WebSocketGateway({ cors: { origin: process.env.CLIENT_URL || '*' } })
```
