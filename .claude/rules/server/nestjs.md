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

## TypeORM createQueryBuilder — orderBy 컬럼명

`orderBy()`에는 DB 컬럼명(snake_case)이 아닌 **Entity 프로퍼티명(camelCase)**을 사용한다.
snake_case로 쓰면 TypeORM이 메타데이터를 찾지 못해 `Cannot read properties of undefined (reading 'databaseName')` 런타임 오류가 발생한다.

```typescript
// X — DB 컬럼명 사용 → 런타임 오류
qb.orderBy('p.updated_at', 'DESC');

// O — Entity 프로퍼티명 사용
qb.orderBy('p.updatedAt', 'DESC');
```

## TypeORM createQueryBuilder — orderBy alias 금지

`addSelect`로 만든 alias를 `orderBy`에 넘기면 TypeORM이 Entity 컬럼 메타를 찾지 못해
`Cannot read properties of undefined (reading 'databaseName')` 런타임 오류가 발생한다.
빌드는 통과하지만 해당 엔드포인트 호출 시 500으로 터진다.

```typescript
// X — alias를 orderBy에 사용하면 런타임 오류
qb.addSelect((sub) => sub.select('COUNT(dp.id)').from(...), 'placeCount')
  .orderBy('placeCount', 'DESC');

// O — orderBy에 서브쿼리 SQL 인라인 사용
qb.orderBy(
  '(SELECT COUNT(dp.day_plan_num) FROM tb_day_plan dp WHERE dp.plan_num = p.plan_num)',
  'DESC',
);
```

## ai-server 프록시 HttpModule 타임아웃 — 다운스트림 상한과 맞춘다

`HttpModule.register({ timeout })`는 모든 요청에 적용되는 **전역 기본값**이다.
ai-server의 무거운 엔드포인트(generate: 최대 60초)가 이 기본값(예: 30초)보다 오래 걸리면,
ai-server가 정상 작업 중인데 프록시가 먼저 끊어 502(BadGateway)가 난다.
빌드는 통과하고 빠른 호출은 멀쩡하나, 생성이 30초를 넘기는 순간 운영에서 항상 터진다.

```typescript
// X — 모듈 기본 30초. generate(ai-server 60초 상한)를 못 기다려 502
HttpModule.register({ timeout: 30_000 })
// forwardGenerate에 per-request timeout 미지정 → 30초 기본값 적용

// O — 느린 엔드포인트는 per-request로 다운스트림 상한 + 여유를 준다
//   ai-server llm_timeout_generate=60 → 프록시 65초 (네트워크·직렬화 여유 5초)
this.httpService.post(url, dto, { headers, timeout: 65_000 })
```

원인: 프록시 타임아웃과 다운스트림(ai-server) 타임아웃을 따로 관리하면 어긋난다.
ai-server의 `llm_timeout_*` 값을 바꿀 때 프록시 per-request timeout도 함께 확인한다.
SSE 스트림(`pipeStreamChat`)은 `timeout: 0`으로 끄되, 단발 요청은 상한을 둬 행(hang) 시 무한 대기를 막는다.

## TypeScript

클라이언트와 동일한 규칙 적용:
- `any` 금지 → `unknown` + 타입 가드
- 매직 넘버 상수 분리
- `console.log` 커밋 금지
