# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Planit** — AI 기반 여행 일정 계획 서비스 (Next.js 15 + FastAPI + NestJS)

## Commands

```bash
cd client && npm run dev          # localhost:3000
cd ai-server && uvicorn main:app --reload --port 8000
cd server && npm run start:dev    # localhost:3001
```

## Architecture

```
client/     Next.js 15 App Router
server/     NestJS
ai-server/  FastAPI + Gemini 2.5 (챗봇 Agent: tool=Flash·답변=Pro 하이브리드)
```

**Plan 페이지**: `SearchContainer(좌) | PlanContainer(중) | MapContainer(우)` 3패널 구조
**상태**: Zustand `usePlanStore` 단일 스토어
**API**: `nestApi`→`:3001` (NEXT_PUBLIC_NEST_URL) — `client/src/config/api.config.ts`
**색상**: `getDayColor(date, dayPlans)` — PlanContainer·MapContainer 공유 (`constants/dayColors.ts`)

## Key Files

| 경로 | 역할 |
|---|---|
| `client/src/store/usePlanStore.ts` | 전역 상태 |
| `client/src/components/common/Button.tsx` | 공용 버튼 (variant: primary·secondary·ghost·danger) |
| `client/src/components/common/` | ThemeProvider · SnackbarProvider · Header · Footer |
| `client/src/constants/dayColors.ts` | 일자별 색상 팔레트 |
| `client/src/app/globals.css` | Tailwind v4 · 다크모드 variant · 애니메이션 |

## Rules

세부 규칙은 `.claude/rules/` 하위 폴더 참조:

| 폴더 | 파일 |
|---|---|
| `frontend/` | `react-nextjs` · `tailwind` · `shared-components` · `timing` · `ui-ux` · `rendering-strategy` |
| `server/` | `nestjs` · `database` · `crud` · `transaction` · `websocket-chat` |
| `ai-server/` | `python` |
| `common/` | `comments` · `typescript` · `verify` · `gc` · `session` · `security` · `git-workflow` |

## Coding Principles

**구현 전**: 가정을 명시한다. 모호하면 질문한다. 더 단순한 방법이 있으면 먼저 제안한다.

**단순성**: 요청된 것만 만든다. 요청되지 않은 기능·추상화·예외처리를 추가하지 않는다. 200줄을 50줄로 줄일 수 있으면 다시 쓴다.

**정밀한 수정**: 필요한 부분만 수정한다. 인접 코드·포맷을 임의로 개선하지 않는다. 내 수정으로 불필요해진 import·변수만 제거한다. 기존 데드 코드는 보고만 한다.

**검증**: 단계마다 성공 기준을 정의한다. "작동하게 만들기"는 기준이 아니다.
