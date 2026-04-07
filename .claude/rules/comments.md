# 주석 스타일

주석은 **왜(why)** 그렇게 했는지를 설명한다. 코드 자체로 읽히는 내용은 주석이 필요 없다.

## 달아야 하는 경우

- 라이브러리의 비직관적인 동작·옵션을 쓸 때
- 외부 제약(API 한도, 서버 특성)으로 특이한 방식을 선택했을 때
- 숫자·상수의 단위나 의도가 코드에서 바로 안 읽힐 때
- 비슷한 다른 방법을 선택하지 않은 이유가 있을 때

```ts
// 카테고리별 순차 호출 — 병렬 호출 시 Rate Limit(429) 위험
for (const type of activeTypes) { await search(type); }

// zoom 15 기준 32px, 1레벨당 ±4px — 너무 작으면 터치 영역이 좁아짐
const size = Math.min(56, Math.max(16, 32 + (zoom - 15) * 4));

// undefined → 아직 미조회 / null → 조회했지만 데이터 없음
if (detailPlace.weekdayDescriptions !== undefined) return;
```

## 달지 않아도 되는 경우

```ts
// X — 코드 자체로 읽힌다
const isActive = selectedDate === day.date; // isActive인지 확인

// X — 반복이 자명함
items.map((item) => item.id); // id 목록 추출
```

## 형식

- 한 줄: `// 설명` — 해당 줄 또는 바로 아래 블록에 적용
- 여러 줄은 `//`를 각 줄에 반복 (블록 주석 `/* */` 지양)
- **한국어**로 작성
- `—` (em dash)로 보충 설명 구분: `// 핵심 — 부연`
