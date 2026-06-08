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
```

> 환율은 open.er-api.com(무인증·무료)을 쓰므로 API 키 환경변수가 필요 없다.

> `NEXT_PUBLIC_` 접두사는 빌드 시 번들에 포함되므로 **빌드 전**에 Railway에 설정해야 한다.

## 환경변수 — planit-ai

```env
GEMINI_API_KEY=<Gemini API Key>
GOOGLE_MAPS_API_KEY=<Google Maps API Key>
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

## Google Routes API 비용 관리

자동생성의 역 삽입 회색지대 판단에 Routes API(`directions/v2:computeRoutes`, WALK)를 사용한다.
같은 `GOOGLE_MAPS_API_KEY`를 쓰지만 **Places와 별도 과금 SKU**다.

- FieldMask를 `routes.duration`만으로 제한해 Essentials 티어(월 1만 회 무료) 유지 — 폴리라인 등을 받으면 Pro 과금
- 회색지대(직선 0.8~2.5km) 구간만 호출하도록 제한 — 그 외 거리는 직선거리로 바로 판단
- **Google Cloud Console → API 및 서비스 → 할당량**에서 Routes API 일일/월 호출 상한을 반드시 설정 (예상치 못한 트래픽 과금 차단)

## Google Places searchText locationBias radius 상한

`places:searchText`의 `locationBias.circle.radius`는 **최대 50,000m(50km)** 다. 초과하면
요청 전체가 400으로 거부돼 resolve가 통째로 실패한다 (빌드는 통과, 배포 후 자동생성 전멸).

```ts
// X — 80km → 400 INVALID_ARGUMENT로 모든 resolve 실패
locationBias: { circle: { center, radius: 80 * 1000 } }

// O — bias는 50km 이하로, 그보다 먼 결과 폐기는 응답 좌표로 별도 검증
locationBias: { circle: { center, radius: 50_000 } }
```

원인: bias 반경(검색 선호)과 결과 검증 반경(폐기 기준)을 같은 상수로 쓰면, 검증을 넓게
잡으려고 키운 값이 API 상한을 넘는다. 둘을 분리한다 (`BIAS_RADIUS_M` vs `CITY_RADIUS_KM`).
