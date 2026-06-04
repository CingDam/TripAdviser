# Git 워크플로 규칙

## pull — 하루 첫 실행 시에만

세션 시작 시 오늘 날짜로 pull을 이미 실행했는지 확인 후 실행한다.

```bash
# 마지막 pull 날짜를 .claude/last-pull 파일에 기록
TODAY=$(date +%Y-%m-%d)
LAST=$(cat .claude/last-pull 2>/dev/null)
if [ "$TODAY" != "$LAST" ]; then
  git pull
  echo "$TODAY" > .claude/last-pull
fi
```

- `.claude/last-pull` 파일이 없거나 날짜가 다르면 pull 실행
- `.claude/last-pull`은 `.gitignore`에 추가해 커밋하지 않는다

## commit — 작업 단위 하나가 끝날 때

기능·버그픽스·리팩터링 등 **논리적으로 하나인 작업**이 완료되면 즉시 커밋한다.

```
# 커밋 메시지 형식
<type>: <한국어 요약>

feat:    새 기능
fix:     버그 수정
refactor: 동작 변화 없는 코드 개선
style:   포매팅·주석 등 로직 무관 변경
chore:   빌드·설정·의존성
```

- 여러 작업을 묶어서 커밋하지 않는다 — 되돌리기와 리뷰가 어려워진다
- 커밋 전 `verify.md` 체크리스트를 확인한다 (console.log, any 타입 등)
- `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` 트레일러를 포함한다

### 여러 줄 메시지는 파일(`-F`)로 — here-string `@'...'@` 금지

PowerShell에서 `git commit -m @'...'@` here-string으로 커밋하면 여닫는 구분자
`@`가 메시지 본문 첫 줄·마지막 줄에 그대로 섞여 들어간다. 커밋 제목이 `@`가 된다.

```powershell
# X — @ 구분자가 메시지에 남아 제목이 "@"가 됨
git commit -m @'
fix: 버그 수정
'@

# O — 임시 파일에 메시지를 쓰고 -F로 읽는다 (구분자 오염 없음)
#   1. Write 도구로 .git/COMMIT_MSG.txt에 메시지 작성
#   2. git commit -F .git/COMMIT_MSG.txt
#   3. 커밋 후 임시 파일 삭제 (rm .git/COMMIT_MSG.txt)
```

- 한 줄 메시지는 `git commit -m "fix: ..."`로 충분 — 파일 불필요
- 이미 `@`가 섞여 커밋됐고 **push 전이면** `git commit --amend -F <파일>`로 정정한다

## push — 모든 작업이 완료된 시점에

그날 계획한 작업이 전부 끝난 뒤, 또는 PR을 열 준비가 됐을 때 한 번 push한다.

- 작업 중간에 push하지 않는다 — 불완전한 상태가 원격에 올라가면 팀원에게 영향을 준다
- push 전 확인:
  - [ ] lint · build 에러 없음 (`verify.md` 빌드 실행 항목)
  - [ ] 커밋 메시지가 작업 단위별로 분리돼 있음
  - [ ] `.env` 등 민감한 파일이 스테이징에 없음
- `main` 브랜치에 force push는 절대 금지 (PreToolUse 훅이 차단)
