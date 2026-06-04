---
name: session-log
description: 작업 완료 시 WORKLOG.md 항목 상태를 갱신하고 .claude/logs/{날짜}.json에 작업 로그를 기록한다. 코드 수정이 끝나 커밋하기 직전에 사용한다. 표준 절차는 .claude/rules/common/session.md를 따른다.
---

# session-log

작업 하나가 완료될 때마다 세션 인수인계용 기록을 남기는 스킬이다.
전체 규칙은 `.claude/rules/common/session.md`에 있다 — 이 스킬은 그 절차를 실행 가능한 형태로 표준화한다.

## 언제 쓰나

코드 수정이 끝났다고 판단되는 즉시. **사용자에게 묻지 않고 자동 실행**한다.
(session.md 규칙: "로그 작성할까요?"라고 묻는 것 자체가 규칙 위반)

## 절차

### 1. WORKLOG.md 갱신
`.claude/WORKLOG.md`에서 해당 작업 항목을 찾아:
- `[~]`(진행중) 또는 `[ ]`(대기) → `[x]`(완료)로 변경
- 상단 `마지막 업데이트` 시각 갱신 — 현재 시각은 `(Get-Date).ToString('HH:mm')`로 조회

### 2. JSON 로그 기록
오늘 날짜 파일 `.claude/logs/{YYYY-MM-DD}.json`의 `tasks` 배열에 항목을 추가한다.
파일이 없으면 새로 생성, 있으면 append.

스키마:
```json
{
  "date": "YYYY-MM-DD",
  "tasks": [
    {
      "id": "snake_case_task_id",
      "title": "작업 제목 (한국어)",
      "status": "completed",
      "area": "frontend | backend | ai-server | infra | docs",
      "files_changed": ["실제 수정·생성한 파일만, 읽기만 한 파일 제외"],
      "summary": "무엇을 + 왜. git 커밋 메시지 수준으로",
      "completed_at": "HH:MM"
    }
  ]
}
```

append를 안전하게 하려면 동봉 스크립트를 쓴다 (수동 편집 시 JSON 깨짐 방지):
```bash
python .claude/skills/session-log/append_log.py \
  --id <snake_case_id> \
  --title "<제목>" \
  --area <frontend|backend|ai-server|infra|docs> \
  --summary "<요약>" \
  --files <file1> <file2> ...
```
`date`와 `completed_at`은 스크립트가 시스템 시각으로 자동 채운다.

### 3. 커밋
코드 변경 커밋에 `.claude/WORKLOG.md`와 갱신된 JSON 로그를 **함께 스테이징**한다.
- 코드 변경이 있으면: 해당 작업 내용으로 커밋 메시지 작성 (`feat:`/`fix:`/`refactor:` 등)
- 코드 변경이 없으면: `chore: 세션 로그 업데이트 (YYYY-MM-DD)`

## 필드 작성 기준 (session.md)

| 필드 | 기준 |
|---|---|
| `id` | 내용을 한눈에 아는 snake_case (예: `add_plan_crud`) |
| `area` | 주로 변경된 레이어 — 둘 이상이면 비중 높은 쪽 |
| `files_changed` | 실제 수정·생성만. 읽기만 한 파일 제외 |
| `summary` | "무엇을" + "왜" 둘 다 포함 |
| `completed_at` | 시스템 현재 시각 HH:MM |
