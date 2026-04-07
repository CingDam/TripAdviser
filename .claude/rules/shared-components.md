# 공용 컴포넌트 규칙

## 원칙

같은 UI나 로직이 **2곳 이상**에서 반복되면 `components/common/`에 공용 컴포넌트로 분리한다.
인라인으로 Tailwind 클래스를 복붙하지 않는다.

## 버튼

프로젝트 전체에서 반복되는 버튼 스타일은 `components/common/Button.tsx`로 통일한다.

```tsx
// X — 여러 파일에 동일한 스타일 중복
<button className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer">
  저장
</button>

// O
<Button variant="primary" onClick={handleSave}>저장</Button>
```

### variant 기준

| variant | 용도 | 라이트 | 다크 |
|---|---|---|---|
| `primary` | 주요 액션 (저장, 검색, 추가) | `bg-gray-900 text-white` | `dark:bg-indigo-600` |
| `secondary` | 보조 액션 | `border border-gray-200 text-gray-600` | `dark:border-white/10 dark:text-white/50` |
| `ghost` | 최소 강조 (취소, 닫기) | `text-gray-400 hover:text-gray-700` | `dark:text-white/30` |
| `danger` | 삭제·초기화 | `border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500` | — |

## 현재 공용 컴포넌트 목록

`client/src/components/common/`:

| 파일 | 역할 | 사용법 |
|---|---|---|
| `ThemeProvider.tsx` | 다크모드 상태 | `useTheme()` → `{ theme, toggle }` |
| `SnackbarProvider.tsx` | 토스트 알림 | `useSnackbar()` → `show(msg, type)` |
| `Header.tsx` | 전역 헤더 | 레이아웃에서 자동 포함 |
| `Footer.tsx` | 전역 푸터 | `(main)` 레이아웃에서만 포함 |

## 공용 상수

반복되는 값은 `client/src/constants/`에 모은다.

| 파일 | 내용 |
|---|---|
| `dayColors.ts` | 일자별 색상 팔레트, `getDayColor(date, dayPlans)` |
| `placeTypes.json` | Google Places 타입 → 한국어 라벨·색상 매핑 |

새로운 공용 상수가 필요하면 인라인에 박지 말고 이 디렉터리에 추가한다.
