# Work Log

> 세션 시작: 2026-04-16
> 마지막 업데이트: 2026-04-16 세션 종료

## 기능 목록

- [x] 하네스 엔지니어링 3단계 세션 관리 구조 추가
- [x] 도시 find-or-create — DB에 없는 도시를 계획 저장 시 자동 등록
- [x] 트랜잭션 rules 추가 (`transaction.md`)
- [x] 저장 버튼 클릭 시 비로그인 안내 모달 + 로그인 페이지 이동
- [x] 도시 검색 모달 z-index 버그 수정 (createPortal + 글래스모피즘 배경)
- [x] 메인에서 도시 검색 후 plan 진입 시 PlanContainer 초기화 안 되는 버그 수정
- [x] 직접 입력 도시 좌표 0,0으로 저장되는 버그 수정 (MapHandler idle 리스너)
- [x] PopularCities 더보기 버튼 + /cities 전체 여행지 페이지 (지역 필터 포함)

## 메모

- 세션 관리 rules: `.claude/rules/common/session.md`
- 완료 로그: `.claude/logs/{YYYY-MM-DD}.json`
- Gmail / Google Calendar MCP 비활성화 검토 필요 (불필요한 컨텍스트 소비)
