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

**Plan 페이지**: `LeftPanel(좌: Calendar+AI/검색 탭)|PlanContainer(중)|MapContainer(우)` 3패널 · 상태는 Zustand `usePlanStore` 단일 스토어
**API/색상**: `nestApi`→`:3001`(`config/api.config.ts`) · `getDayColor(date, dayPlans)`로 PlanContainer·MapContainer 색 공유

## Key Files

| 경로 | 역할 |
|---|---|
| `client/src/store/usePlanStore.ts` | 전역 상태 |
| `client/src/components/common/` | Button(primary·secondary·ghost·danger) · Theme/Snackbar/QueryProvider · Header · Footer · FadeIn |
| `client/src/constants/dayColors.ts` | 일자별 색상 팔레트 |
| `client/src/app/globals.css` | Tailwind v4 · 다크모드 variant · 애니메이션 |

## Rules

세부 규칙은 `.claude/rules/` 하위 폴더 참조:

| 폴더 | 파일 |
|---|---|
| `frontend/` | `react-nextjs` · `tailwind` · `shared-components` · `timing` · `ui-ux` · `rendering-strategy` |
| `server/` | `nestjs` · `database` · `crud` · `transaction` · `websocket-chat` |
| `ai-server/` | `python` |
| `common/` | `comments` · `typescript` · `verify` · `gc` · `session` · `security` · `git-workflow` · `railway` · `harness` |

## Harness Workflow

메인 세션이 오케스트레이터다. 요청 유형별 agent·skill 위임, hooks 자동 감독, GC 발동 타이밍의 상세는 `.claude/rules/common/harness.md` 참조.
표준 흐름: **코드 수정 → `code-reviewer` → 통과 시 `session-log` skill로 로그 → commit**. CRUD 생성은 `crud-builder` agent에 위임한다.

## Coding Principles

**구현 전**: 가정을 명시한다. 모호하면 질문한다. 더 단순한 방법이 있으면 먼저 제안한다.

**단순성**: 요청된 것만 만든다. 요청되지 않은 기능·추상화·예외처리를 추가하지 않는다. 200줄을 50줄로 줄일 수 있으면 다시 쓴다.

**정밀한 수정**: 필요한 부분만 수정한다. 인접 코드·포맷을 임의로 개선하지 않는다. 내 수정으로 불필요해진 import·변수만 제거한다. 기존 데드 코드는 보고만 한다.

**검증**: 단계마다 성공 기준을 정의한다. "작동하게 만들기"는 기준이 아니다.
