# Tailwind CSS 4 스타일 규칙

## Tailwind v4 문법

- `@import "tailwindcss"` 사용 — v3의 `@tailwind base/components/utilities` 아님
- 다크모드 variant 재정의: `@variant dark (&:where(.dark, .dark *))` — `@custom-variant` 아님
- 클래스 기반 다크모드: `<html>`에 `.dark` 클래스 → ThemeProvider가 토글

## 다크모드 처리

JS 조건문으로 클래스를 분기하지 않는다. `dark:` 접두사로만 처리한다.

```tsx
// X
className={isDark ? 'bg-black' : 'bg-white'}

// O
className="bg-white dark:bg-black"
```

## 인라인 style과 Tailwind 혼용 기준

- **동적으로 계산된 값** (색상 hex, 픽셀 숫자) → `style={{}}`
- **정적 레이아웃·간격** → Tailwind 클래스

```tsx
// O — 동적 색상은 style, 레이아웃은 Tailwind
<div
  className="w-8 h-8 rounded-full flex items-center justify-center"
  style={{ background: color }}
/>
```

## 다크모드 색상 토큰 (프로젝트 표준)

브랜드 팔레트: `#FBFBFB` 배경 / `#E8F9FF` 서피스 / `#C4D9FF` 보더 / `#C5BAFF` 액센트

| 용도 | 라이트 | 다크 |
|---|---|---|
| 페이지 배경 | `bg-[#FBFBFB]` | `dark:bg-[#1c1c1e]` |
| 패널/카드 배경 | `bg-white` | `dark:bg-[#2c2c2e]` |
| 보조 배경 | `bg-white/80` | `dark:bg-[#252527]` |
| 주요 액션 버튼 | `bg-[#C5BAFF] text-[#1a1a2e]` | `dark:bg-[#A89AFF] dark:text-[#1a1a2e]` |
| 보더 | `border-[#C5BAFF]/20` (카드) · `border-[#C4D9FF]` (인풋) | `dark:border-white/8` |
| 본문 텍스트 | `text-[#1a1a2e]` | `dark:text-white/90` |
| 보조 텍스트 | `text-[#1a1a2e]/50` | `dark:text-white/30` |
| 강조 링크·라벨 | `text-[#7B6FD0]` | `dark:text-[#A89AFF]` |

위 토큰을 벗어난 임의 색상을 추가할 때는 이유를 주석으로 명시한다.
