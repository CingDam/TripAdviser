# 세션 관리 규칙

작업 진행 상황을 세션 간에 인수인계하기 위한 구조다.
두 파일을 항상 최신 상태로 유지한다.

```
.claude/WORKLOG.md          현재 세션 — 기능 목록 + 진행 상태
.claude/logs/{YYYY-MM-DD}.json   완료된 작업 로그 (날짜별 누적)
```

---

## WORKLOG.md 관리

### 언제 업데이트하나

| 시점 | 동작 |
|---|---|
| 새 세션 시작 시 | WORKLOG.md가 없으면 생성, 있으면 이전 상태 이어받기 |
| 작업 착수 시 | 해당 항목 상태를 `[ ]` → `[~]` (진행 중)으로 변경 |
| 작업 완료 시 | 상태를 `[~]` → `[x]` (완료)로 변경 + JSON 로그 기록 |
| 새 작업 추가 시 | 목록에 `[ ]`로 추가 |

### 파일 형식

```markdown
# Work Log

> 세션 시작: {날짜}
> 마지막 업데이트: {날짜 + 시간}

## 기능 목록

- [x] 완료된 작업
- [~] 진행 중인 작업
- [ ] 대기 중인 작업

## 메모

세션 간 인수인계가 필요한 컨텍스트, 결정 사항, 블로커 등을 기록한다.
```

---

## JSON 로그 기록

작업 하나가 완료될 때마다 `.claude/logs/{YYYY-MM-DD}.json`에 추가한다.
파일이 없으면 새로 생성, 있으면 `tasks` 배열에 추가한다.

### 파일 형식

```json
{
  "date": "YYYY-MM-DD",
  "tasks": [
    {
      "id": "snake_case_task_id",
      "title": "작업 제목 (한국어)",
      "status": "completed",
      "area": "frontend | backend | ai-server | infra | docs",
      "files_changed": [
        "client/src/components/foo/Bar.tsx",
        "server/src/plan/plan.service.ts"
      ],
      "summary": "무엇을 왜 변경했는지 한두 줄로 요약",
      "completed_at": "HH:MM"
    }
  ]
}
```

### 필드 기준

| 필드 | 작성 기준 |
|---|---|
| `id` | 작업 내용을 한눈에 알 수 있는 snake_case (예: `add_plan_crud`, `fix_dark_mode`) |
| `area` | 주로 변경된 레이어 — 둘 이상이면 가장 비중 높은 쪽 |
| `files_changed` | 실제로 수정·생성한 파일만. 읽기만 한 파일 제외 |
| `summary` | "무엇을" + "왜" 두 정보를 포함. git 커밋 메시지 수준으로 |
| `completed_at` | 로컬 시간 HH:MM (예: "14:32") |

---

## 작업 완료 시 필수 절차

코드 수정이 끝났다고 판단되는 즉시 아래 두 가지를 **반드시 자동으로** 실행한다.
사용자에게 확인을 요청하거나 검토를 요청하지 않는다. 보고도 하지 않는다.
로그 기록은 작업의 마지막 단계이며 사용자 응답 전에 완료되어야 한다.

```
1. WORKLOG.md 열기 → 해당 항목 [~] → [x] + 마지막 업데이트 시각 갱신
2. .claude/logs/{오늘날짜}.json 열기 → tasks 배열에 항목 추가
   (파일 없으면 새로 생성)
```

이 절차를 생략하면 세션 간 인수인계가 불가능하다.

## 기타 규칙

- WORKLOG.md는 항상 `.claude/` 루트에 둔다 — 프로젝트 루트 아님
- JSON 로그는 날짜별 파일로 분리한다 — 하나의 파일에 모두 쌓지 않음
- 새 세션 시작 시 WORKLOG.md를 먼저 읽어 컨텍스트를 복원한다
