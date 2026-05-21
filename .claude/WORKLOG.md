# Work Log

> 세션 시작: 2026-04-16
> 마지막 업데이트: 2026-05-21

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
- [x] 배포 보안 점검 — WebSocket JWT 인증 / Rate Limiting / FastAPI CORS 수정 + security.md 규칙 추가
- [x] 보안 2차 점검 — AI 프롬프트 인젝션 방어 / npm audit fix / Next.js 15.5.15 / remotePatterns R2 추가
- [x] 토스트 너비 반응형 — 모바일 전체폭 / 태블릿 384px / PC 448px
- [x] 브랜드 색상 팔레트 오션 블루로 전면 교체 — #2563EB / #DBEAFE / white 기반, FAQ·환율·Cities 포함 전체 적용
- [x] Pexels API 연동 — 도시 추가(POST /api/city) 시 대표 이미지 자동 저장
- [x] 도시 중복 등록 방지 — cityName + country 조합 중복 시 409 반환
- [x] plan.service.ts resolveCity에 Pexels 이미지 연동 — 일정 저장 시 신규 도시도 이미지 자동 저장
- [x] 인기 여행지 도시 목록 ISR → SSR 전환 — cache: 'no-store'로 도시 추가 즉시 반영
- [x] ai-server 자동정렬 개선 — 숙소 시작/종점, 카테고리 누락 유실 수정, 식사 횟수 제한, 시간대 슬롯 위치 배치
- [x] ai-server 자동정렬 LLM 주도 구조 전환 — Gemini 2.5 Flash가 정렬·시간대 부여, 코드는 검증 가드레일, 클라이언트 시간대 배지
- [x] 커뮤니티 게시글에 일정 첨부·복제 기능 — tb_community.plan_num FK + 본인 소유 검증, POST /clone-plan으로 일정 깊은 복사, 작성 모달 셀렉트, 상세 페이지 일정 카드 + 일자별 아코디언 + 가져가기 버튼
- [x] 커뮤니티 서버 사이드 키워드 검색 + 인기순/최신순 정렬 — GET /community?keyword=&sort=popular|latest, 프론트 400ms 디바운스 서버 요청, 토글 버튼 UI
- [x] 실시간 알림 — NotificationGateway(/notification namespace) + useNotification 훅, 댓글·좋아요 시 게시글 작성자에게 WebSocket 전달, 헤더 벨 아이콘 + 드롭다운
- [x] 공개 일정 가로 슬라이더 + 읽기전용 뷰 — GET /plan/public, /plan/view/[planNum] 페이지, PublicPlanSlider(최신순/장소많은순), CommunityList·CityHub에 삽입
- [x] 공개 일정 장소순 정렬 TypeORM databaseName 런타임 오류 수정 — addSelect alias orderBy → 서브쿼리 인라인
- [x] 커뮤니티 무한스크롤 — '더 보기' 버튼 제거, IntersectionObserver sentinel div (rootMargin 200px)로 자동 다음 페이지 로드
- [x] 커뮤니티 신고 기능 — tb_report 테이블, POST /community/:id/report + /comment/:id/report, 게시글·댓글·대댓글 신고 버튼 + 모달, 중복 신고 409 처리
- [x] plan 페이지 UX 버그 3건 수정 — 도착일 클릭 시 달력 즉시 열기 / 다크모드 전환 시 지도 위치 초기화 방지 / 카테고리 선택 후 텍스트 검색 시 필터 자동 초기화
- [x] 캘린더 react-day-picker 제거 → date-fns 직접 구현 — 월 선택 그리드, 범위 선택, 다크모드 완전 대응
- [x] 캘린더 도착일 UX 수정 — 도착일 버튼 클릭 시 출발일 고정 후 도착일만 재선택 모드(selectingEnd)
- [x] 장소 카드 카테고리 이모지 배경 + 가격대 배지 — photo API 대신 placeTypes.json 이모지·색상 배경, priceLevel Basic SKU 추가
- [x] Places API 호출 절감 — 진입 자동 검색 제거, 60개 버퍼 후 스크롤 무한 페이지네이션(20개씩)
- [x] 해외 도시 검색 시 국내 장소 노출 + 맵 자동 이동 버그 수정 — locationRestriction ±0.18° 박스 + selectedPlace 초기화
- [x] 검색 카테고리 다양화 — tourist 4개·restaurant 2개 서브쿼리 분산 + hotel/transport 카테고리 독립 추가
- [x] 검색 결과 bounds 이중 필터 — API restriction 우회분 클라이언트 후처리
- [x] 도시 진입 시 지도 줌 13 자동 설정
- [x] 이 지역 검색 카테고리 유지 + hotel·transport 해제 시 재검색 + 선택 시 버튼 즉시 표시
- [x] 텍스트 검색 시 cityCenter restriction 제거 — 다른 도시(하네다 공항 등) 검색 안 되는 버그 수정
- [x] 헤더 여행 계획 → 도시 검색 모달로 연결 (CitySearchModalContent 분리)
- [x] 계획 패널 접기 시 부모 박스 잔존 + 모바일 레이아웃 깨짐 수정 (isCollapsed 부모로 이동)
- [x] 장소 상세 패널 슬라이드 방향 수정 — 우측 진입 → 좌측 진입 + cubic-bezier 이징
- [x] fullReset에 searchTypes·showAreaSearch 누락 수정 — 페이지 재진입 시 카테고리 잔존 버그
- [x] plan 레이아웃 언마운트 시 fullReset 추가 — 로고 클릭 등 모든 이탈 경로에서 상태 정리
- [x] ai-server Place 모델·프롬프트 검색 타입(shopping·bar·transport) 대응
- [x] 모바일 뒤로가기 시 메인 이동 안 되는 버그 수정 — popstate에서 장소 없을 때 router.push('/') 추가
- [x] 공개 일정 URL 복사 공유 버튼 — Share2 아이콘, navigator.clipboard, 토스트 확인
- [x] 마이페이지 일정 보기 지도+탭+목록 레이아웃으로 교체 — PlanViewReadonlyClient와 동일한 UI, /plan/:planNum API 유지
- [x] planview·마이페이지 마커 클릭 InfoWindow 팝업 제거
- [x] 날짜 탭 전환 시 해당 날짜 1번 마커로 지도 자동 이동
- [x] 마이페이지 프로필 수정 — 닉네임 인라인 편집 + 프로필 이미지 업로드 (PATCH /api/user/me, useAuthStore profileImg·setProfile 추가)
- [x] 커뮤니티 게시글 이미지 업로드 UI — 이미 구현돼 있었음 확인
- [x] 전역 error.tsx 추가 — 재시도/홈 이동 UI
- [x] 리뷰 CRUD — GET(장소별)/POST/DELETE + 장소 상세 패널 API 연결
- [x] 알림 읽음 처리 — 드롭다운 열기 시 markAllRead() 이미 구현돼 있음 확인
- [x] 일정 공항·호텔 자동배치 — 날짜 확정 시 TripSetupModal, SlotItem 고정 렌더링, 날짜별 슬롯 개별 변경
- [x] 서버 구조화 로깅 — HTTP 인터셉터 + 전역 예외 필터 + 서비스 레이어 Logger (Auth·Plan·Community)
- [x] ai-server 구조화 로깅 — HTTP 미들웨어 + 서비스 Logger (sort), LLM 응답시간 포함
- [x] place-search ai-server → NestJS 이전 — JWT 인증·Rate Limiting 적용, ai-server는 Gemini 정렬 전담
- [x] 공항·호텔 검색 /api/api 이중 경로 404 버그 수정 — TripSetupModal·SlotEditModal
- [x] AI 채팅 도우미 + 일정 자동생성 — POST /api/chat (B), POST /api/generate (C), AiChatPanel FAB, PlanContainer "AI로 채우기" 버튼
- [x] AI 자동생성 장소 Google Places resolve 연동 — POST /place-search/resolve, 실제 place_id·좌표 확보 후 dayPlans 삽입
- [x] AI 채팅 장소 추가 액션 — "추가해줘" 요청 시 action JSON 응답, 날짜 드롭다운 + 추가 버튼 카드 UI
- [x] 챗봇 프롬프트 트리거 확장 + 가독성 개선 — "자동으로 짜줘/일정 짜줘" 등 다양한 표현 인식, day_plans 빈 경우 날짜 설정 안내, ol 순서 리스트 렌더링 추가
- [x] place-search JWT 가드 제거 — 비로그인 공항·호텔 검색 + AI resolve 401 버그 수정
- [x] [AiChatPanel] 에러 메시지 UI — AI 서버 실패 시 피드백
- [x] [AiChatPanel] 중복 요청 방지 — loading 중 Enter도 차단
- [x] [AiChatPanel] ActionCard 날짜 미선택 시 버튼 비활성화 + 추가 완료 후 카드 제거
- [x] [AiChatPanel] 대화 히스토리 AI 전달 — 최근 N개 messages 포함
- [x] [AiChatPanel] 세션 대화 내역 sessionStorage 백업/복원
- [x] [AiChatPanel] city 미설정 시 안내 메시지 표시
- [x] [AiChatPanel] 장소 추가 실패 시 스낵바 에러 표시
- [x] [AiChatPanel] 패널 높이 max-h-[70vh] 전환 + 모바일 safe-area 대응
- [x] AI 챗봇 빠른 질문 칩 4종 + 대화 초기화 버튼
- [x] AI 챗봇 패널 오픈 시 일정 자동 분석 안내 메시지
- [x] AI 챗봇 프롬프트 개선 3종 (한국어 강제·중복 장소 제외·여행 기간 컨텍스트)
- [x] AI 응답 취소 버튼 (AbortController — loading 중 빨간 X)
- [x] AI 자동생성 식당·카페 추천 강화 — 날짜별 식당 2곳·카페 1곳 필수 프롬프트 + resolve 카테고리 힌트 적용
- [x] AI 빈 날짜 자동생성 버튼 + 챗봇 일일 일정 정렬 — 일부 날짜 작성 후에도 빈 날짜 채우기 표시, 챗봇 장소 추가 후 자동 정렬
- [x] AI 채우기/자동정렬 FAB 우선순위 수정 — 현재 날짜에 정렬 가능 장소가 있으면 자동정렬 버튼 우선 표시
- [x] [ChatPanel] WebSocket 재연결 로직 + 연결 끊김 UI 피드백
- [x] [ChatPanel] 채팅방 목록에 마지막 메시지·시간 표시
- [x] [ChatPanel] 이전 메시지 더보기 (페이지네이션 — before 파라미터 활용)
- [x] [ChatPanel] 프로필 이미지 표시 — Gateway join 시 senderProfile 전달
- [x] [공통] 다크모드 누락 색상 수정 — ChatPanel text-gray-* dark: 추가
- [x] AI 챗봇 UX 개선 — 동적 컨텍스트 칩 + 스타일 온보딩 + ActionCard 리디자인 + SSE 스트리밍
- [x] AI 프록시 JWT 가드 제거 — 비로그인자도 채팅·자동생성·정렬 접근 가능
- [x] Railway FASTAPI_URL 프로토콜 누락(Invalid URL) 수정
- [x] 챗봇 장소 추가 후 정렬 시 슬롯(호텔·공항) 유실 버그 수정
- [x] 챗봇 장소 추천 개수 상한 8 → 12개로 증가
- [x] 챗봇 UX 개선 4종 — action 스트리밍 토큰, resolve 병렬화, 스타일칩 조건 정합, 추가 취소 버튼
- [x] AI 챗봇 대화 메모리 + 근처 장소 실시간 주입 — conversation_city 추적, nearby Places API B안 구현
- [x] 챗봇·자동생성 정렬 후 슬롯(공항·호텔) 위치 깨짐 수정 — dayIndex 기준 before/after 분리
- [x] AI 챗봇 UI 개선 4종 + 히스토리 버튼 — textarea 입력창, 타임스탬프, 패널 드래그 리사이즈, 이전 대화 접기
- [x] AI 챗봇 Agent화 (옵션 B) — Gemini function calling + Streaming Thinking + diff 미리보기. Tool 4종(search_places·get_weather·propose_add·propose_replace), Agent loop 최대 5 step, SSE thinking/thinking_result 이벤트, ThinkingBox 접힘 UI, ActionCard 교체 diff 표시
- [x] AI 챗봇 Agent 깊이 강화 v2 — 시스템 프롬프트 4단계(PLAN/RESEARCH/VERIFY/PROPOSE) 재설계, Tool 3개 추가(compare_places·evaluate_day_balance·get_trip_context), agent_service에 _day_plans 컨텍스트 주입, ThinkingBox에 신규 tool 아이콘 매핑
- [ ] 일정 PDF/이미지 내보내기 (선택)
- [ ] 관리자 어드민 — 신고 처리, 도시 관리 (선택)
- [ ] Sentry 에러 모니터링 연동 (선택)
- [x] 리뷰 좋아요(tb_review_like) 구현 — DB 테이블은 있으나 API·UI 미구현
- [x] 리뷰 평점 집계 — 장소별 평균 평점 계산 및 표시 미구현
- [x] 공개 일정 가져가기 검증 — plan/view 페이지 가져가기 버튼 추가 + POST /plan/:id/clone 엔드포인트 구현
- [x] 서버 ESLint 자동 포맷 정리 — auth/community/plan/review 긴 줄 포맷 반영
- [ ] 테스트 코드 작성 — NestJS(서비스 단위 테스트), 클라이언트(주요 훅·컴포넌트) 전무
- [x] 검색 결과 정렬 기준 개선 — 평점×log(리뷰수) 인기도 점수로 카테고리 편향 제거
- [x] 쇼핑 카테고리 필터 오분류 수정 — store·supermarket 제거, 구체적 쇼핑 타입으로 교체
- [x] 검색 결과 더 보기 버튼 — 스크롤 영역 밖 하단 고정
- [x] 더 보기 서브쿼리 분할 호출 — 첫 검색 3번, 더 보기 시 카테고리별 나머지 서브쿼리 순차 API 호출
- [x] 더 보기 버튼 조건부 표시 — ResizeObserver로 스크롤 가능 여부 감지, 불가 시에만 버튼 표시
- [x] 검색 로직 원래 방식 복원 — 전체 서브쿼리 한번에 호출 후 버퍼에서 20개씩 append
- [x] 쇼핑·바·호텔·교통 카테고리 선택 즉시 자동 검색 — 이 지역 검색 버튼 단계 제거

## 2026-05-21 — AI 챗봇 Agent 고도화 v3

- [x] Tool 결과 캐싱 — 세션 내 동일 인자 중복 호출 방지
- [x] 병렬 Tool 호출 — asyncio.gather로 같은 step 다중 tool 동시 실행
- [x] get_directions Tool 추가 — 이동 시간·교통수단 추천
- [x] estimate_budget Tool 추가 — 도시별 단가 기반 예산 추정
- [x] 장기 메모리(요약) — 6턴 너머는 LLM 요약해서 system에 주입

## 2026-05-21 — AI 챗봇 UI 모더나이즈 (Linear/Vercel 풍 + 우측 사이드시트)

- [x] 사이드시트 레이아웃 — FAB+팝업 → 우측 sheet (지도 위 오버레이, 풀하이트 420px)
- [x] 헤더·입력창 중성 톤으로 교체 — 그라디언트 제거, zinc 베이스 + 단색 액센트
- [x] 메시지 버블 — 아바타 제거, AI는 풀폭 텍스트 / 유저는 zinc-900 단색 버블, 폰트 14px·줄간 1.65
- [x] ThinkingBox·ActionCard·칩 — zinc 톤으로 재조정, 체크박스·Day 카드도 모노톤
- [x] FAB 컴팩트 단색 zinc-900 원형으로 교체

## 2026-05-18 작업 우선순위 — AI 챗봇·자동생성·대화 서버 리뷰

### P0 — 보안·비용 리스크 먼저 차단

- [x] 채팅방 WebSocket 권한 검증 — joinRoom/sendMessage에서 JWT 사용자 기준 room membership 확인, 방 멤버가 아니면 join/send 거부
- [x] 채팅 메시지 조회 보호 — GET /chat/rooms/:roomNum/messages에 JWT 가드 + room membership 검증 추가
- [x] ai-server 호출 보호 — /api/chat, /api/generate, /api/sort에 인증/서명 토큰 또는 NestJS 프록시 적용
- [x] ai-server rate limit 적용 — Gemini 비용 보호용 IP/사용자 단위 제한, 과도 호출 시 429 반환

### P1 — 자동생성 품질·정합성 강화

- [x] /api/generate 응답 검증 강화 — 요청 날짜 외 extra date 제거/거부, 날짜별 places 빈 배열 거부, 중복 장소 제거
- [x] 자동생성 카테고리 검증 — 관광지·식당·카페·쇼핑·자연·문화 허용값만 통과, 식당 2곳·카페 1곳 최소 조건 확인
- [x] Google Places resolve 정확도 개선 — locationBias/도시명 검증/후보 3개 스코어링으로 동명이소 장소 오삽입 방지
- [x] 자동생성 부분 실패 피드백 — resolve 실패 개수와 생성 결과 0건 상황을 Snackbar로 사용자에게 표시
- [x] 자동생성 후 정렬 연결 — 날짜별 장소 삽입 후 /api/sort 호출해 timeSlot 부여 및 동선 정렬

### P2 — 챗봇 안정성·UX 개선

- [x] LLM JSON 파싱 안정화 — structured output 또는 JSON schema 방식 적용, 코드블록 외 설명 섞인 응답 fallback 처리
- [x] /api/chat action 검증 강화 — action.places 타입/카테고리/개수 검증, 비정상 JSON은 사용자 노출 없이 일반 안내로 fallback
- [x] AiChatPanel 전송 로직 통합 — handleSend와 handleQuickReply 중복 제거, 빠른 질문에도 AbortController 적용
- [x] 챗봇 장소 추가 정렬 실패 복구 — 장소 추가 성공/정렬 실패 상태를 분리하고 재정렬 버튼 또는 안내 제공

### P3 — 운영·테스트 보강

- [x] ai-server timeout/retry 정책 명시 — Gemini 호출 지연·일시 실패 시 사용자 응답 시간 상한 설정
- [x] ai-server 단위 테스트 추가 — _extract_json, generate 응답 검증, chat action normalize 케이스
- [x] NestJS 채팅 권한 테스트 추가 — 비멤버 join/send/messages 거부, 멤버 정상 접근 검증
- [x] 운영 로그 정리 — LLM raw 응답/개인 메시지 과다 로깅 방지, error detail에 외부 API 에러 원문 노출 최소화

## 메모

- 세션 관리 rules: `.claude/rules/common/session.md`
- 완료 로그: `.claude/logs/{YYYY-MM-DD}.json`
- Gmail / Google Calendar MCP 비활성화 검토 필요 (불필요한 컨텍스트 소비)

## 2026-05-18 코드 리뷰 Findings

### 높음 — 수정 필요

1. **ActionCard 정렬 실패 UI 버그** (`AiChatPanel.tsx` line 104, 111)
   - `setSortFailed(true)` 직후 `if (added > 0)` 분기에서 이전 렌더의 `sortFailed=false`를 보고 성공 토스트 + `onDone()` 호출 → 카드 언마운트 → 재정렬 UI 사라짐
   - 수정: `setSortFailed` 대신 로컬 변수로 실패 여부를 추적하고 `onDone` 호출 조건에 반영

2. **INTERNAL_SECRET fail-fast 없음** (`config.py` line 6, `main.py` line 35, `ai-proxy.service.ts` line 20)
   - `INTERNAL_SECRET`이 비어 있으면 Nest도 헤더 안 보내고, ai-server도 검증 건너뜀 → 운영 env 하나 빠지면 ai-server 다시 공개 상태
   - 수정: production에서 `INTERNAL_SECRET` 미설정 시 서버 시작 실패 처리

### 중간 — 개선 권장

3. **rate limit IP 오동작** (`main.py` line 22, `chat.py` line 12)
   - Nest 프록시를 거치면 ai-server가 Nest 서버 IP 하나만 봄 → 사용자별 제한이 아닌 서비스 전체 공용 20/min, 5/min 동작
   - 수정: Nest `/ai/*`에 `@Throttle` 사용자 기준 제한 추가, ai-server rate limit은 내부 보호용으로만 유지

4. **자동생성 후 정렬 시 슬롯 위치 깨짐** (`PlanContainer.tsx` line 400)
   - `existing?.places.filter((p) => p.slotType)`로 모든 호텔/공항을 앞에 몰아넣어 체크아웃/도착 슬롯도 생성 장소 앞에 붙음
   - 수정: `handleSort`처럼 first/last normal 기준으로 before/after 슬롯 분리

### 낮음 — 환경 정비

5. **pytest 실행 환경 미정비** (`test_chat_service.py` line 3, `requirements.txt` line 1)
   - ai-server `.venv`에 pytest 없음 → 테스트 실행 안 됨
   - 수정: `requirements.txt`에 `pytest` dev dependency 추가 또는 별도 `requirements-dev.txt`

### 확인된 통과 항목
- `server/src/chat/chat-room.service.spec.ts` Jest 테스트: 통과
- `server` build: 통과
- `client` build: 통과
