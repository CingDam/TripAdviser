# Work Log

> 세션 시작: 2026-04-16
> 마지막 업데이트: 2026-04-23 09:10

## 기능 목록

- [x] 하네스 엔지니어링 3단계 세션 관리 구조 추가
- [x] 도시 find-or-create — DB에 없는 도시를 계획 저장 시 자동 등록
- [x] 트랜잭션 rules 추가 (`transaction.md`)
- [x] 저장 버튼 클릭 시 비로그인 안내 모달 + 로그인 페이지 이동
- [x] 도시 검색 모달 z-index 버그 수정 (createPortal + 글래스모피즘 배경)
- [x] 메인에서 도시 검색 후 plan 진입 시 PlanContainer 초기화 안 되는 버그 수정
- [x] 직접 입력 도시 좌표 0,0으로 저장되는 버그 수정 (MapHandler idle 리스너)
- [x] PopularCities 더보기 버튼 + /cities 전체 여행지 페이지 (지역 필터 포함)
- [x] 커뮤니티 페이지 — 목록(/community) + 상세(/community/[id]), 좋아요·댓글·대댓글 포함
- [x] 도시별 커뮤니티 허브 — /city/[cityNum] (날씨·관광지 사이드바 + 도시 커뮤니티 게시글)
- [x] 커뮤니티 목록 데스크탑 리디자인 — max-w-7xl, 도시 카드 그리드, 2열 게시글
- [x] 커뮤니티 목록 N+1 성능 개선 — loadRelationCountAndMap으로 좋아요 수 1쿼리 집계
- [x] 커뮤니티 페이지 초기 로딩 개선 — page.tsx SSR로 데이터 미리 채움, 도시 카드 next/image 전환
- [x] 채팅 기능 구현 — NestJS Socket.IO + MongoDB(메시지) + MySQL(채팅방 메타), 도시별 채팅방 목록/생성/입장/채팅 UI
- [x] 헤더 메뉴 센터 고정 + 메뉴 링크 실제 페이지로 이동
- [x] Railway 배포 규칙 + 설정 파일 생성 (railway.json × 3, requirements.txt, CORS env var 처리)
- [x] Railway 배포 시 ReferenceError: crypto is not defined 수정 (main.ts polyfill + engines 명시)
- [x] Railway 클라이언트 빌드 시 @tailwindcss/oxide 네이티브 바이너리 오류 수정 (nixpacks.toml)

## 메모

- 세션 관리 rules: `.claude/rules/common/session.md`
- 완료 로그: `.claude/logs/{YYYY-MM-DD}.json`
- Gmail / Google Calendar MCP 비활성화 검토 필요 (불필요한 컨텍스트 소비)
