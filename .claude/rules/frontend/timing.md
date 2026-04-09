# 타이밍 제어 규칙

## setTimeout / sleep — 최후의 수단

시간 기반 대기는 환경마다 타이밍이 달라 버그를 만든다.
**상태·이벤트·Promise 완료 시점**을 직접 이용하는 것이 우선이다.

```ts
// X — "애니메이션이 끝날 것 같은 시간"을 임의로 기다림
setTimeout(() => setVisible(false), 300);

// O — CSS transition 종료 이벤트를 직접 감지
<div onTransitionEnd={() => setVisible(false)} />

// X — 데이터가 로드됐을 것 같은 시간을 기다림
setTimeout(() => refetch(), 1000);

// O — 작업 완료 후 체이닝
await saveData();
refetch();
```

### setTimeout을 써도 되는 경우

- 토스트 자동 닫기처럼 **사용자 경험상 의도적인 지연**이 필요할 때
- 외부 라이브러리가 완료 콜백을 제공하지 않아 불가피할 때

→ 위 두 경우 모두 **주석으로 이유를 명시**한다.

---

## 디바운스 / 쓰로틀

입력마다 디바운스를 걸면 응답 지연이 생기고 코드가 복잡해진다.
**이벤트 발생 시점이 아니라 의미 있는 액션 시점**에 실행하도록 설계한다.

```ts
// X — 키 입력마다 디바운스 후 검색 → 체감 지연 발생
const handleChange = debounce((value) => search(value), 300);

// O — 검색 버튼 클릭 / Enter 확정 시점에 실행
const handleSubmit = () => search(inputValue);
```

### 디바운스가 불가피한 경우 (resize, scroll 이벤트 등)

외부 라이브러리 없이 `useRef`로 직접 구현해 의존성을 최소화한다.
디바운스 시간은 상수로 빼고 이유를 주석으로 명시한다.

```ts
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleResize = () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  // resize가 연속 발생하므로 마지막 이벤트만 처리 — 150ms는 사람이 인지 못하는 최소 지연
  timerRef.current = setTimeout(updateLayout, 150);
};
```
