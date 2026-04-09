# TypeScript 규칙

## `any` 사용 금지

타입을 모를 때는 `unknown`을 쓰고 타입 가드로 좁힌다.

```ts
// X
catch (error: any) { console.log(error.message) }

// O
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
}
```

## `as any` 절대 금지

타입 단언은 타입이 확실한 경우에만 `as SomeType` 형태로만 쓴다.

```ts
// X
const data = response as any;

// O — 인터페이스가 정의된 경우에만
const data = response as ApiResponse;
```

## 매직 넘버·문자열 금지

의미 있는 값은 상수로 분리하고 단위·의도를 명시한다.

```ts
// X
setTimeout(fn, 3500);

// O
const TOAST_DURATION_MS = 3500;
setTimeout(fn, TOAST_DURATION_MS);
```

## 함수·컴포넌트 크기

한 화면에 다 보이지 않을 정도로 길어지면 분리를 고려한다.
