# Python (ai-server) 규칙

ai-server는 FastAPI + LangChain + Gemini 구조다.

## 코드 스타일

- **타입 힌트 필수** — 함수 인자와 반환값에 모두 명시
  ```python
  # X
  def sort_places(places, date):

  # O
  def sort_places(places: list[Place], date: str) -> list[Place]:
  ```
- **Pydantic 모델** — 요청/응답 스키마는 `core/models.py`에 정의. 딕셔너리를 직접 반환하지 않음
- **비즈니스 로직** — `services/`에만 작성. `routers/`는 요청 수신·응답 반환만 담당

## 구조 규칙

```
routers/   HTTP 엔드포인트만 (DI, 검증)
services/  핵심 로직 (분류, 정렬 알고리즘)
core/      공용 모델·프롬프트·설정
```

새 기능 추가 시 이 구조를 유지한다. 라우터에 로직을 직접 작성하지 않는다.

## 환경 변수

- `.env` 파일은 절대 커밋하지 않는다 (`.gitignore` 필수)
- 환경변수는 `config.py`의 Pydantic `Settings`를 통해서만 접근
  ```python
  from config import settings
  api_key = settings.gemini_api_key  # os.environ 직접 접근 금지
  ```

## Gemini 호출 안정성

Gemini 2.5 시리즈는 기본적으로 내부 추론(thinking) 토큰을 생성한다.
정렬·분류처럼 제약이 많은 작업에서 thinking이 폭주하면 응답이 느려져 타임아웃된다.

```python
# X — thinking 무제한 → 장소 10개+ 정렬 시 35초 초과로 DeadlineExceeded
ChatGoogleGenerativeAI(model="gemini-2.5-flash", request_timeout=35, max_retries=0)

# O — 결정적 작업(정렬·분류)은 thinking_budget으로 추론량을 제한
# 0(완전 끄기)은 동선 품질 저하 우려 → 512 같은 낮은 고정값으로 폭주만 차단
ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    request_timeout=45,
    max_retries=0,        # 지수 백오프로 2분+ 블로킹 방지 — 즉시 실패 후 클라이언트 재시도
    thinking_budget=512,
)
```

원인: thinking_budget을 지정하지 않으면 Gemini가 추론 토큰을 동적으로 생성하는데,
순열 탐색이 필요한 작업(동선 최적화 등)에서 이 양이 급증해 request_timeout을 초과한다.

## 주석

- 한국어로 작성 (클라이언트 코드베이스 통일)
- 알고리즘 로직(분류 기준, 거리 계산 방식)에는 반드시 주석 명시
