# Work Log

> 세션 시작: 2026-04-16
> 마지막 업데이트: 2026-04-27 (토스트 하단 중앙 전환)

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
- [x] 도시 조회 및 메일 서비스 디버깅용 로그 추가
- [x] Railway SMTP IPv6 ENETUNREACH 수정 (main.ts dns ipv4first)
- [x] SSR 페이지 도시 목록 미호출 수정 (NEXT_NEST_URL → NEXT_PUBLIC_NEST_URL 3곳)
- [x] Railway SMTP Connection timeout 수정 (Resend HTTP API로 교체)
- [x] tb_comment updated_at 없음 오류 수정 (@UpdateDateColumn 제거)
- [x] 이미지 업로드 로컬 디스크 → S3 버킷으로 교체 (aws-sdk, CommonModule)
- [x] Cloudflare R2 연동 및 403 공개 접근 수정 (Railway Tigris → R2 교체)
- [x] 메일 서비스 Resend → Brevo 교체 (무료 플랜 타인 발송 제한 해결)
- [x] S3Service 개발/프로덕션 분기 — NODE_ENV 기준 로컬 디스크 vs R2 자동 전환
- [x] 소셜 로그인 구현 — Google·Kakao·Naver OAuth2 (Passport 전략 + 프론트 소셜 버튼·콜백 페이지)
- [x] 마이페이지 소셜 계정 연동 — 연동/해제 UI + link-init 코드 발급 → OAuth 리다이렉트 → 콜백 link 모드 처리
- [x] 마이페이지 새로고침 시 로그인 페이지로 튕기는 버그 수정 — Zustand persist hydration 타이밍 (_hasHydrated 플래그)
- [x] 일정 수정 시 도시값 초기화 버그 수정 — currentCityNum 스토어 추가, PlanEditLoader·SavePlanModal 연동
- [x] 일정 수정 시 캘린더 날짜 미표시 버그 수정 — currentStartDate·currentEndDate 스토어 추가, Calendar useEffect 동기화
- [x] 카카오 인앱 브라우저 구글/네이버 로그인 차단 처리 — UA 감지 후 버튼 비활성화 + 외부 브라우저 유도 안내
- [x] 플랜 페이지 반응형 — 모바일 하단 탭바(검색/일정/지도) + 데스크톱 3패널 유지
- [x] 플랜 반응형 마커 미렌더링 수정 — MapContainer 중복 마운트 통합(데스크톱·모바일 단일 트리)
- [x] SearchContainer 버튼 토글 — 날짜에 이미 추가된 장소는 '삭제하기'로 전환 (addedPlaceIds Set)
- [x] 일정 추가 slide-in 애니메이션 — placeCardIn keyframe + useMemo/useEffect 새 항목 감지
- [x] 메인 커뮤니티 탭 게시글 미표시 수정 — res.data → res.data.data (페이지네이션 응답 구조 불일치)
- [x] 다크모드 블루/인디고 색상 정합성 수정 — 장소 썸네일·액션버튼·날짜·링크 뉴트럴화
- [x] 메인 포인트 컬러 인디고/바이올렛 → 로즈/핑크 전환 — 전체 20개 파일 교체
- [x] 토스트 위치 우측상단 → 하단 중앙 전환 + 슬라이드 애니메이션 교체

## 메모

- 세션 관리 rules: `.claude/rules/common/session.md`
- 완료 로그: `.claude/logs/{YYYY-MM-DD}.json`
- Gmail / Google Calendar MCP 비활성화 검토 필요 (불필요한 컨텍스트 소비)
