# NestJS (server) 규칙

## 아키텍처 — MVVM 레이어드 패턴

NestJS 서버는 MVVM의 서버 사이드 버전인 **레이어드 아키텍처**로 구성한다.

| 레이어 | 파일 | 역할 | 금지 사항 |
|---|---|---|---|
| **Controller** (View) | `*.controller.ts` | HTTP 요청 수신, 응답 반환, 인증 가드 | 비즈니스 로직, DB 접근, 조건 분기 |
| **Service** (ViewModel+Model) | `*.service.ts` | 비즈니스 로직, DB 쿼리, 예외 처리 | HTTP 관련 코드 |
| **DTO** | `dto/*.dto.ts` | 요청 스키마 정의, 입력 검증 | 로직 포함 금지 |
| **Entity** | `entities/*.entity.ts` | DB 테이블 매핑 | 로직 포함 금지 |

```
// X — Controller에 비즈니스 로직
@Get(':id')
async findOne(@Param('id') id: number) {
  const post = await this.repo.findOne({ where: { id } }); // DB 직접 접근
  if (!post) throw new NotFoundException();                 // 예외 처리
  return post;
}

// O — Controller는 위임만
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.communityService.findOne(id); // Service에 위임
}
```

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

## TypeORM Entity

`nullable: true` 컬럼은 반드시 `type`을 명시한다.
TypeORM이 `string | null` 유니온을 리플렉션으로 읽으면 `Object`로 인식해 런타임 에러가 발생한다.
빌드는 통과하지만 서버 시작 시 `DataTypeNotSupportedError`로 터진다.

```typescript
// X — type 없으면 런타임에 DataTypeNotSupportedError
@Column({ length: 255, nullable: true })
profileImg: string | null;

// O
@Column({ type: 'varchar', length: 255, nullable: true })
profileImg: string | null;
```

nullable이 아닌 컬럼은 TypeScript 타입에서 추론 가능하므로 생략 가능.

## TypeORM WHERE — null 조건

`where` 절에 `null`을 직접 쓰면 타입 오류가 발생한다. `IsNull()`을 사용한다.

```typescript
// X — TS2322 타입 오류
where: { parent: null }

// O
import { IsNull } from 'typeorm';
where: { parent: IsNull() }
```

## Floating Promise

`void`를 붙이지 않은 Promise는 eslint `no-floating-promises` 에러가 발생한다.
`bootstrap()` 같은 최상위 async 함수 호출에 반드시 `void`를 붙인다.

```typescript
// X
bootstrap();

// O
void bootstrap();
```

## TypeScript

클라이언트와 동일한 규칙 적용:
- `any` 금지 → `unknown` + 타입 가드
- 매직 넘버 상수 분리
- `console.log` 커밋 금지
