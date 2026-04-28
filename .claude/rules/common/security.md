# 보안 규칙

배포 환경에서 발생할 수 있는 취약점을 방지하기 위한 규칙이다.

## 환경변수

`.env` 파일은 절대 커밋하지 않는다. `.gitignore`에 반드시 포함한다.

```
# X — 비밀키를 코드에 하드코딩
const secret = 'planit-secret-key';

# O — 환경변수에서 로드
const secret = configService.getOrThrow<string>('JWT_SECRET');
```

`NEXT_PUBLIC_` 접두사는 빌드 번들에 포함된다 — 외부에 노출되어도 되는 값에만 붙인다.
API Key, JWT Secret, DB 비밀번호는 절대 `NEXT_PUBLIC_`로 노출하지 않는다.

## CORS

NestJS와 FastAPI 모두 `origin: '*'` 와일드카드를 사용하지 않는다.
`CLIENT_URL` 환경변수로 허용 origin을 지정하고, 없을 때는 개발용 localhost만 허용한다.

```typescript
// X — 프로덕션에서 모든 origin 허용
origin: process.env.CLIENT_URL || '*'

// O — 없을 때 localhost로 폴백
origin: process.env.CLIENT_URL || 'http://localhost:3000'
```

FastAPI는 허용 메서드와 헤더도 최소화한다.

```python
# X
allow_methods=["*"], allow_headers=["*"]

# O — 서버에서 실제 사용하는 것만
allow_methods=["GET", "POST"],
allow_headers=["Content-Type", "Authorization"],
```

## WebSocket 인증

WebSocket 연결 시 `handleConnection`에서 JWT를 검증한다.
클라이언트가 전송하는 `userNum`을 신뢰하지 않는다 — JWT에서 직접 추출한다.

```typescript
// X — 클라이언트 전송값을 그대로 사용 (위변조 가능)
@SubscribeMessage('sendMessage')
async handleMessage(@MessageBody() payload: { userNum: number; content: string }) {
  await this.chatService.saveMessage({ userNum: payload.userNum, ... });
}

// O — handshake 토큰 검증 후 소켓에 userNum 부착
handleConnection(client: Socket) {
  const token = (client.handshake.auth as Record<string, string>).token;
  const payload = this.jwtService.verify<JwtPayload>(token, { secret });
  (client as AuthenticatedSocket).userNum = payload.sub;
}

@SubscribeMessage('sendMessage')
async handleMessage(@MessageBody() payload: { content: string }, @ConnectedSocket() client: Socket) {
  const authed = client as AuthenticatedSocket;
  await this.chatService.saveMessage({ userNum: authed.userNum, ... });
}
```

클라이언트는 소켓 연결 시 `auth.token`에 JWT를 넣는다.

```typescript
// O
const socket = io(NEST_URL, { auth: { token } });
```

## Rate Limiting

`@nestjs/throttler`로 인증 관련 엔드포인트를 보호한다.
`APP_GUARD`로 전역 등록(기본 60회/분) 후, 민감한 엔드포인트에 `@Throttle`로 추가 제한한다.

```typescript
// 이메일 발송 — 외부 API 비용 발생, 분당 5회
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Post('send-verification')
sendVerification(...) {}

// 로그인·회원가입 — 브루트포스 방지, 분당 10회
@Throttle({ default: { ttl: 60_000, limit: 10 } })
@Post('login')
login(...) {}
```

## 파일 업로드

Multer 설정에서 파일 타입과 크기를 반드시 검증한다.

```typescript
// O
fileFilter: (_, file, cb) => {
  cb(null, file.mimetype.startsWith('image/'));
},
limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
```

저장 시 원본 파일명을 버리고 타임스탬프 + 랜덤값으로 교체한다. (path traversal 방지)

## 비밀번호 응답 노출

Service에서 user 객체를 반환할 때 `pw` 필드를 반드시 제거한다.

```typescript
// O
const { pw, ...rest } = user;
return rest;
```

## AI 서버 — 프롬프트 인젝션 방어

사용자 입력을 LLM에 전달할 때 두 가지 원칙을 지킨다.

**1. 입력값 검증 — Pydantic validator로 길이·형식을 제한한다.**

```python
# X — 검증 없이 그대로 프롬프트에 삽입
class SortRequest(BaseModel):
    places: list[Place]
    date: str

# O — 길이·형식 제한으로 인젝션 페이로드 차단
class SortRequest(BaseModel):
    places: list[Place] = Field(max_length=20)  # 하루 최대 20개
    date: str = Field(max_length=10)

    @field_validator('date')
    @classmethod
    def validate_date(cls, v: str) -> str:
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', v):
            raise ValueError('날짜 형식은 YYYY-MM-DD이어야 합니다')
        return v
```

**2. 프롬프트 구조 — system/human 메시지를 분리한다.**

```python
# X — 단일 템플릿에 사용자 데이터를 삽입하면 지시문으로 해석될 수 있음
ChatPromptTemplate.from_template("... 장소: {places}")

# O — system(지시문)과 human(데이터)을 별도 메시지로 분리
ChatPromptTemplate.from_messages([
    ("system", "지시문 — 이 내용은 사용자 입력과 섞이지 않는다"),
    ("human", "장소 데이터:\n{places}"),
])
```

## next/image remotePatterns

`next/image`가 최적화할 수 있는 외부 도메인을 `next.config.ts`에 명시한다.
허용하지 않은 도메인은 500 에러가 발생하고, 와일드카드(`**`)는 DoS 공격 면적을 넓히므로 실제 사용하는 도메인만 등록한다.

```typescript
// X — 모든 외부 이미지 허용
remotePatterns: [{ hostname: '**' }]

// O — 실제 사용하는 도메인만 명시
remotePatterns: [
  { protocol: "https", hostname: "maps.googleapis.com" },
  { protocol: "https", hostname: "*.r2.dev" },          // Cloudflare R2 퍼블릭 버킷
  { protocol: "https", hostname: "images.pexels.com" },
]
```

`BUCKET_PUBLIC_URL` 환경변수(런타임)와 `remotePatterns`(빌드 타임)는 독립적이다 — 환경변수 변경 시 `remotePatterns`도 함께 확인한다.

## 의존성 관리

배포 전 `npm audit`을 실행하고 high/critical 취약점이 없는지 확인한다.

```bash
cd server && npm audit
cd client && npm audit
```

- **high·critical** → 즉시 `npm audit fix` 또는 수동 업그레이드
- **moderate** → devDependency 여부 확인 후 판단
- Next.js는 보안 패치가 자주 나오므로 마이너 버전 범위(`^15.x`)를 유지하며 최신 패치를 따라간다
