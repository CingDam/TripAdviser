# NestJS (server) 규칙

server는 현재 스캐폴딩 단계다. 기능 추가 시 아래 규칙을 따른다.

## 구조

```
src/
├── app.module.ts          루트 모듈 — 기능 모듈을 여기서 import
└── {feature}/
    ├── {feature}.module.ts
    ├── {feature}.controller.ts   HTTP 라우팅만
    ├── {feature}.service.ts      비즈니스 로직
    └── dto/
        ├── create-{feature}.dto.ts
        └── update-{feature}.dto.ts
```

새 기능은 반드시 독립 모듈로 분리한다. `AppModule`에 직접 로직을 작성하지 않는다.

## DTO

요청/응답 스키마는 DTO 클래스로 정의하고 `class-validator` 데코레이터로 검증한다.
```typescript
// X — 타입 없이 바로 받음
@Post() create(@Body() body: any) {}

// O
@Post() create(@Body() createDto: CreateItineraryDto) {}
```

## 에러 처리

NestJS 내장 예외를 사용한다. 커스텀 에러 메시지를 `throw new Error()`로 던지지 않는다.
```typescript
// X
throw new Error('찾을 수 없음');

// O
throw new NotFoundException('일정을 찾을 수 없습니다');
```

## 포트

클라이언트(Next.js)가 `3000`을 점유하므로 server는 반드시 `3001`을 사용한다.
`server/.env`에 `PORT=3001`을 명시적으로 설정하고, 클라이언트 `api.config.ts`의 `NEXT_NEST_URL` 기본값(`:3001`)과 맞춘다.

## TypeScript

클라이언트와 동일한 규칙 적용:
- `any` 금지 → `unknown` + 타입 가드
- 매직 넘버 상수 분리
- `console.log` 커밋 금지
