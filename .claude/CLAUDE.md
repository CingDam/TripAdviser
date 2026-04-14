# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Planit** — AI 기반 여행 일정 계획 서비스 (Next.js 15 + FastAPI + NestJS)

## Commands

```bash
# Client (localhost:3000)
cd client && npm run dev
cd client && npm run build
cd client && npm run lint

# AI Server (localhost:8000)
cd ai-server && uvicorn main:app --reload --port 8000

# Backend (기본 localhost:3000, PORT 환경변수로 변경)
cd server && npm run start:dev
```

## Architecture

```
client/     Next.js 15 App Router — 프론트엔드
server/     NestJS — 백엔드 (스캐폴딩 단계)
ai-server/  FastAPI + Gemini 2.5 Flash — AI 정렬
```

**Plan 페이지**: `SearchContainer(좌) | PlanContainer(중) | MapContainer(우)` 3패널 구조
**상태**: Zustand `usePlanStore` 단일 스토어 — 검색·일정·지도 상태 통합 관리
**라우팅**: `(main)` Header+Footer / `(plan)` Header만 + `h-screen` 전체 높이
**API**: `aiApi`→`:8000` (NEXT_FASTAPI_URL) / `nestApi`→`:3001` (NEXT_NEST_URL) — `client/src/config/api.config.ts`
**AI 정렬**: 앵커(관광지·숙소) + 서브(식당·카페) 분류 후 최근접 이웃 알고리즘
**색상**: `getDayColor(date, dayPlans)` — PlanContainer·MapContainer 공유 (`constants/dayColors.ts`)

## Key Files

| 경로 | 역할 |
|---|---|
| `client/src/store/usePlanStore.ts` | 전역 상태 |
| `client/src/hook/usePlaceSearch.ts` | Google Places 검색 (순차 호출) |
| `client/src/components/common/Button.tsx` | 공용 버튼 (variant: primary·secondary·ghost·danger) |
| `client/src/components/common/` | ThemeProvider · SnackbarProvider · Header · Footer |
| `client/src/constants/dayColors.ts` | 일자별 색상 팔레트 |
| `client/src/app/globals.css` | Tailwind v4 · 다크모드 variant · 애니메이션 |

## Rules

세부 규칙은 `.claude/rules/` 하위 폴더 참조:

| 폴더 | 파일 |
|---|---|
| `frontend/` | `react-nextjs` · `tailwind` · `shared-components` · `timing` · `ui-ux` · `rendering-strategy` |
| `server/` | `nestjs` · `database` · `crud` |
| `ai-server/` | `python` |
| `common/` | `comments` · `typescript` · `verify` · `gc` |
