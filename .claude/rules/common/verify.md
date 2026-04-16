# 출력 검증 규칙

코드 작성 후 커밋 전에 아래 항목을 스스로 확인한다.

## 공통 체크리스트

- [ ] `console.log` 디버그 로그가 남아있지 않은가
- [ ] `any` / `as any` 타입이 새로 추가되지 않았는가
- [ ] 매직 넘버·문자열이 인라인으로 박히지 않았는가
- [ ] `alert()` / `confirm()`이 사용되지 않았는가
- [ ] `setTimeout`을 대체 가능한 이벤트·Promise로 교체했는가

## 컴포넌트 작성 시

- [ ] 동일 버튼 스타일을 인라인으로 복붙하지 않았는가 → `Button` 컴포넌트 사용
- [ ] 다크모드를 JS 조건문이 아닌 `dark:` 접두사로 처리했는가
- [ ] `'use client'`를 꼭 필요한 경우에만 추가했는가
- [ ] `useEffect` deps 배열을 임의로 비우지 않았는가

## API / 서버 작업 시

- [ ] DTO 없이 `body: any`로 요청을 받지 않았는가 (NestJS)
- [ ] `throw new Error()` 대신 NestJS 내장 예외를 사용했는가
- [ ] 환경변수를 `os.environ` 직접 접근이 아닌 `settings`로 읽었는가 (Python)
- [ ] `.env` 파일이 커밋에 포함되지 않았는가

## 린트 / 빌드 실행

코드 수정이 완료되면 아래 명령어를 **직접 실행**하고 에러가 없을 때만 작업을 완료로 간주한다.

```bash
# 클라이언트 (client/ 수정 시)
cd client && npm run lint
cd client && npm run build

# NestJS 서버 (server/ 수정 시)
cd server && npm run lint
cd server && npm run build

# AI 서버 (ai-server/ 수정 시)
cd ai-server && python -m py_compile $(git diff --name-only HEAD -- '*.py')
```

- 린트 에러 발생 시 → 즉시 수정 후 재실행
- 빌드 에러 발생 시 → 원인 파악 후 수정, 사용자에게 보고
- 수정 없이 넘어가지 않는다

## rules/ 파일 정합성

코드가 rules 규칙과 어긋나는 방향으로 작성됐다면, 코드를 수정하거나 rules를 업데이트한다.
규칙을 어길 수밖에 없는 경우 해당 줄에 이유를 주석으로 명시한다.

## 세션 로그 기록 (작업 완료의 마지막 단계)

린트·빌드까지 통과하면 반드시 아래 두 파일을 업데이트한다. 생략하지 않는다.

1. `.claude/WORKLOG.md` — 해당 항목 `[~]` → `[x]` + 마지막 업데이트 시각 갱신
2. `.claude/logs/{오늘날짜}.json` — `tasks` 배열에 항목 추가 (파일 없으면 새로 생성)

사용자에게 보고하거나 확인을 요청하지 않는다. 응답 전에 완료한다.
