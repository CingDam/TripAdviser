# Planit ✈️

> AI 기반 여행 일정 계획 서비스 — 도시를 고르고, 지도에서 장소를 담고, AI 플래너와 대화하며 동선을 완성한다.

여행 블로거 출신 컨셉의 **Planit AI**가 장소를 추천하고, 전체 일정을 자동 생성하며, 날짜별 동선을 최적화한다. 사용자는 3패널 에디터에서 검색 → 담기 → 정렬 → 저장까지 한 화면에서 끝낼 수 있다.

---

## 주요 기능

| 영역 | 기능 |
|---|---|
| **AI 플래너 (챗봇)** | 장소 추천 · 일정 분석 · 예산 추정 · 날씨 조회 · 두 장소 비교 — SSE 스트리밍 + tool 호출 기반 Agent |
| **일정 자동생성** | "3박4일 오사카-교토" 같은 요청으로 날짜별 일정 전체 생성, 꼭 가고 싶은 장소(`must_visit`) 강제 포함 |
| **동선 정렬** | 날짜별 담은 장소를 Gemini가 이동 효율 기준으로 재정렬, 중간 교통 거점(역) 자동 삽입 |
| **3패널 에디터** | `검색(좌) · 일정(중) · 지도(우)` 구조, 드래그 앤 드롭 순서 변경, 일자별 색상 구분 |
| **지도 연동** | Google Maps 위에 장소·마커·동선 표시, Places 검색 |
| **커뮤니티** | 게시글 · 댓글/대댓글 · 좋아요 · 이미지 첨부 · 일정 공유 |
| **리뷰** | 장소 리뷰 작성 · 평점 · 좋아요 · 이미지 |
| **실시간 채팅** | 도시별/1:1 채팅방, WebSocket(Socket.IO) + MongoDB 메시지 저장 |
| **인증** | 이메일 회원가입(인증코드) · JWT · Google/Kakao/Naver 소셜 로그인 |

---

## 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   client        │     │   server        │     │   ai-server     │
│   Next.js 15    │────▶│   NestJS        │────▶│   FastAPI       │
│   :3000         │     │   :3001         │     │   :8000         │
│                 │     │                 │     │   Gemini 2.5    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────┴────────┐
                        │  MySQL  │ MongoDB │
                        │ (메타)  │ (채팅)  │
                        └─────────┴─────────┘
```

- **client** — Next.js 15 App Router. 서버 컴포넌트 우선, 인터랙션은 하위 클라이언트 컴포넌트로 분리. 상태는 Zustand 단일 스토어(`usePlanStore`)
- **server** — NestJS 레이어드 아키텍처(Controller/Service/Entity). 메타데이터는 MySQL(TypeORM), 채팅 메시지는 MongoDB(Mongoose). AI 서버 호출은 `ai-proxy`가 `X-Internal-Secret`으로 중계
- **ai-server** — FastAPI + LangChain + Gemini 2.5. tool 호출은 빠른 **Flash**, 사용자가 읽는 최종 답변만 **Pro**를 쓰는 하이브리드 구조

> 클라이언트는 AI 서버를 직접 호출하지 않는다. NestJS `ai-proxy`만이 내부 시크릿으로 ai-server에 접근한다.

---

## 기술 스택

**Client** — Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · Zustand · TanStack Query · @vis.gl/react-google-maps · dnd-kit · Socket.IO Client

**Server** — NestJS 11 · TypeORM(MySQL) · Mongoose(MongoDB) · Passport(JWT·Google·Kakao·Naver) · Socket.IO · Throttler

**AI Server** — FastAPI · LangChain · langchain-google-genai(Gemini 2.5 Flash·Pro) · slowapi(rate limit)

**Infra** — Railway(3개 서비스 분리 배포) · Cloudflare R2/S3(이미지) · Open-Meteo(날씨) · Google Maps/Places/Routes API

---

## 시작하기

### 사전 요구사항

- Node.js ≥ 20
- Python ≥ 3.11
- MySQL · MongoDB
- API Key: Gemini · Google Maps

### 1. 클라이언트

```bash
cd client
npm install
npm run dev          # http://localhost:3000
```

### 2. NestJS 서버

```bash
cd server
npm install
npm run start:dev    # http://localhost:3001
```

### 3. AI 서버

```bash
cd ai-server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000   # http://localhost:8000
```

---

## 환경 변수

각 서비스 디렉터리에 `.env` 파일을 둔다. (커밋 금지 — `.gitignore`에 포함)

### client/.env

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<API Key>
NEXT_PUBLIC_GOOGLE_MAPS_ID=<Map ID>
NEXT_PUBLIC_NEST_URL=http://localhost:3001
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
EXCHANGE_API_KEY=<환율 API Key>
```

### server/.env

```env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=<user>
DB_PASSWORD=<password>
DB_NAME=tripit
MONGODB_URI=mongodb+srv://<user>:<pw>@<host>/<db>
JWT_SECRET=<강력한 랜덤 키>
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
INTERNAL_SECRET=<ai-server 호출 인증 시크릿>
# 메일·소셜·R2 등 추가 변수는 .claude/rules/common/railway.md 참조
```

### ai-server/.env

```env
GEMINI_API_KEY=<Gemini API Key>
GOOGLE_MAPS_API_KEY=<Google Maps API Key>
INTERNAL_SECRET=<server와 동일한 시크릿>
NEST_URL=http://localhost:3001
CLIENT_URL=http://localhost:3000
```

> `NEXT_PUBLIC_` 접두사 변수는 빌드 시 번들에 포함된다 — 외부 노출돼도 되는 값에만 사용한다.

---

## 디렉터리 구조

```
.
├── client/                  Next.js 15 (App Router)
│   └── src/
│       ├── app/             라우트 (SC만) — (main) · (plan) 그룹
│       ├── components/      도메인별 클라이언트 컴포넌트
│       ├── store/           usePlanStore (Zustand)
│       ├── constants/       dayColors · placeTypes
│       └── config/          api.config.ts
├── server/                  NestJS
│   └── src/
│       ├── auth/            JWT · 소셜 로그인 · 이메일 인증
│       ├── plan/            여행 일정 CRUD
│       ├── community/       게시글 · 댓글 · 좋아요
│       ├── review/          장소 리뷰
│       ├── chat/            WebSocket 채팅 (MySQL 메타 + MongoDB 메시지)
│       ├── place-search/    Google Places 검색 중계
│       ├── ai-proxy/        ai-server 내부 호출 게이트웨이
│       └── city · user · notification · common
├── ai-server/               FastAPI + Gemini
│   ├── routers/             sort · chat (HTTP 엔드포인트)
│   ├── services/
│   │   ├── agent_service    tool 호출 Agent loop (SSE)
│   │   ├── chat_service     채팅 · 자동생성 · 교통거점 선택
│   │   ├── sort_service     동선 정렬
│   │   └── tools/           search_places · propose_* · evaluate_* 등 10개 tool
│   └── core/                models · prompts · city_coords
└── document/                DB 스키마(SQL) · ERD · 학습 가이드
```

---

## API 개요

NestJS 서버는 `/api` 프리픽스를 사용한다.

| 컨트롤러 | 경로 | 역할 |
|---|---|---|
| auth | `/api/auth` | 회원가입 · 로그인 · 소셜 · 이메일 인증 |
| user | `/api/user` | 회원 정보 |
| plan | `/api/plan` | 여행 일정 CRUD |
| city | `/api/city` | 도시 목록 · 상세 |
| community | `/api/community` | 게시글 · 댓글 · 좋아요 |
| review | `/api/review` | 리뷰 · 좋아요 |
| place-search | `/api/place-search` | Google Places 검색·근처 |
| chat/rooms | `/api/chat/rooms` | 채팅방 메타 (메시지는 WebSocket) |
| ai | `/api/ai` | ai-server 중계 (채팅·정렬·자동생성) |

FastAPI(ai-server) 엔드포인트: `/api/chat` · `/api/chat/stream`(SSE) · `/api/generate` · `/api/sort` · `/api/select-transit`

---

## 배포

Railway에 **3개 서비스**로 분리 배포한다. 각 서비스의 Root Directory를 `client` / `server` / `ai-server`로 지정한다. 자세한 환경 변수·빌드 설정은 [.claude/rules/common/railway.md](.claude/rules/common/railway.md) 참조.

---

## 데이터베이스

스키마는 [document/foward_engineering_sql.sql](document/foward_engineering_sql.sql)에 정의돼 있다. 주요 테이블: `tb_user` · `tb_plan` · `tb_day_plan` · `tb_city` · `tb_community` · `tb_review` · `tb_chat_room`. 전체 명세는 [.claude/rules/server/database.md](.claude/rules/server/database.md) 참조.
