# 하네스 워크플로 규칙

메인 세션이 오케스트레이터다. 요청 유형에 따라 agent·skill로 위임하고, hooks가 자동 감독한다.
(CLAUDE.md의 `## Harness Workflow`는 이 파일의 한 줄 요약이다)

## 위임 라우팅

| 트리거 | 위임 대상 | 종류 | 위치 |
|---|---|---|---|
| "OO CRUD 만들어줘", 새 도메인 추가 | `crud-builder` | agent | `.claude/agents/` |
| 코드 수정 완료 직후, "리뷰해줘", 커밋·push 직전 | `code-reviewer` | agent | `.claude/agents/` |
| 작업 완료 (커밋 직전 로그 기록) | `session-log` | skill | `.claude/skills/` |

## 원칙

- agent/skill은 `rules/`를 **참조**한다 — 규칙 원문은 rules에만 두고 중복 서술하지 않는다 (`gc.md`)
- `.claude/rules/`는 자동 로드되지 않는다. 필요할 때 Read로 직접 열어야 컨텍스트에 들어온다 — 폴더 위치(common/·frontend/ 등)는 로드 비용과 무관하다

## 자동 감독 (settings.json hooks)

| 시점 | 동작 |
|---|---|
| PostToolUse (Edit·Write) | 변경 파일에 tsc·eslint(client) / py_compile(ai-server) 자동 실행 |
| PreToolUse (Bash) | 소스 디렉토리·`.env` 삭제, main force push 차단 |
| Stop | `check_log.py`로 로그 누락(console.log 등) 점검 |

## 표준 흐름

```
코드 수정 → code-reviewer → 통과 → session-log → commit
                                  └→ GC 점검
```

## GC 발동 타이밍

GC(`gc.md`)는 **작업 사이클이 끝났을 때(code-reviewer 통과 직후)만** 발동한다.
코딩 중간에는 발동하지 않는다 — 작업 몰입을 끊지 않기 위해서다.
