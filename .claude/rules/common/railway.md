---
name: Railway 배포 규칙
description: Railway 모노레포 배포 설정 및 환경변수 관리 규칙
type: project
---

# Railway 배포 규칙

이 프로젝트는 Railway에 **3개 서비스**로 분리 배포한다.

```
client/      → Railway Service "planit-client"
server/      → Railway Service "planit-server"
ai-server/   → Railway Service "planit-ai"
```

## 배포 구조

Railway 대시보드에서 각 서비스마다 **Root Directory**를 다르게 설정해 모노레포를 운영한다.

| 서비스 | Root Directory | Build | Start |
|---|---|---|---|
| planit-client | `client` | `npm run build` | `npm start` |
| planit-server | `server` | `npm run build` | `npm run start:prod` |
| planit-ai | `ai-server` | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

## 환경변수 — planit-server

```env
PORT=3001
DB_HOST=<Railway MySQL 내부 호스트>
DB_PORT=3306
DB_USER=tripit
DB_PASSWORD=<비밀번호>
DB_NAME=tripit
MONGODB_URI=mongodb+srv://<user>:<pw>@<host>/<db>?appName=<app>
JWT_SECRET=<강력한 랜덤 키>
JWT_EXPIRES_IN=7d
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=<이메일>
MAIL_PASS=<앱 비밀번호>
CLIENT_URL=https://<planit-client Railway 도메인>
```

## 환경변수 — planit-client

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<API Key>
NEXT_PUBLIC_GOOGLE_MAPS_ID=<Map ID>
NEXT_PUBLIC_NEST_URL=https://<planit-server Railway 도메인>
NEXT_PUBLIC_FASTAPI_URL=https://<planit-ai Railway 도메인>
EXCHANGE_API_KEY=<환율 API Key>
```

> `NEXT_PUBLIC_` 접두사는 빌드 시 번들에 포함되므로 **빌드 전**에 Railway에 설정해야 한다.

## 환경변수 — planit-ai

```env
GEMINI_API_KEY=<Gemini API Key>
```

## CORS 관리

- NestJS: `CLIENT_URL` 환경변수로 허용 origin 지정 (`server/src/main.ts`)
- FastAPI: `CLIENT_URL` 환경변수로 허용 origin 지정 (`ai-server/main.py`)
- `CLIENT_URL`이 없으면 개발용 `http://localhost:3000` 폴백

## 주의사항

- Railway는 `PORT` 환경변수를 자동 주입한다 — 하드코딩 금지
- `requirements.txt`가 없으면 ai-server 빌드 실패 — 의존성 추가 시 반드시 업데이트
- Next.js `NEXT_PUBLIC_*` 변수는 빌드 시점에 번들에 포함 — 배포 후 변경 시 재배포 필요
- DB 연결은 Railway MySQL 플러그인 내부 호스트(`${{MySQL.MYSQL_HOST}}` 등) 사용 권장
