# React / Next.js 규칙

## `useEffect` 의존성 배열

deps를 임의로 비우지 않는다. 외부 상태를 참조하지 않는 경우(마운트 1회 fetch, 초기화)만 `[]`로 놔둔다.
deps를 지우는 대신 함수를 컴포넌트 바깥으로 빼거나 `useCallback`을 올바르게 사용한다.

## 같은 id가 여러 목록에 나타날 수 있으면 컨테이너를 날짜·그룹 key로 재마운트

dnd-kit `SortableContext`(`useSortable({ id })`)와 React `key`는 **id가 전역 유일**이라고 가정한다.
자동생성에서 같은 역(동일 `place_id`)이 여러 날 하차역으로 들어가면, 탭을 전환해도 dnd-kit이
이전 날짜의 동일 id 노드를 정리하지 못해 **다른 날 항목이 현재 탭 상단에 잔존**한다.

```tsx
// X — 날짜만 바꾸면 같은 place_id 노드가 재사용돼 잔존
<DndContext onDragEnd={...}>
  <SortableContext items={normalPlaces.map((p) => p.place_id)}>

// O — 날짜 전환 시 DnD 트리를 통째로 재마운트
<DndContext key={selectedDate} onDragEnd={...}>
  <SortableContext items={normalPlaces.map((p) => p.place_id)}>
```

## `alert()` / `confirm()` 금지

`useSnackbar()` 훅의 `show(message, type)` 으로 대체한다.

```ts
// X
alert('저장되었습니다');

// O
const { show } = useSnackbar();
show('저장되었습니다', 'success');
```

타입: `'success' | 'error' | 'warning' | 'info'`

## `'use client'` 최소화

서버 컴포넌트로 유지할 수 있으면 유지한다.
`useState`, `useEffect`, 브라우저 API(`window`, `document` 등)를 직접 쓸 때만 추가한다.

## `console.log` 커밋 금지

디버깅용 로그는 작업 후 반드시 제거한다.
서버에서 영속적으로 필요한 로그는 `console.error` / `console.warn`을 쓴다.
