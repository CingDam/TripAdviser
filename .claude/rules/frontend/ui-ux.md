# UI/UX 규칙 — 2026 트렌드 기준

UI/UX 작업 시 아래 원칙을 따른다. 시대에 뒤처진 디자인 패턴은 피한다.

## 레이아웃 & 공간감

- **여백을 넉넉하게** — 빽빽한 UI보다 breathing room이 있는 레이아웃. `p-6` 이상 기본, 섹션 간격은 `gap-8` 이상
- **카드 곡률** — `rounded-2xl` ~ `rounded-3xl` 기본. `rounded` / `rounded-md`는 너무 각져 보인다
- **그리드보다 플로우** — 고정 그리드 대신 `flex-wrap` / CSS Grid `auto-fill`로 콘텐츠 양에 자연스럽게 반응

## 색상 & 대비

- **저채도 배경 + 포인트 컬러** — 새하얀 배경(#fff)보다 약간 회색감 있는 배경(`bg-gray-50`, `dark:bg-[#1c1c1e]`)
- **글래스모피즘** — 모달·사이드패널에 `backdrop-blur-xl bg-white/80 dark:bg-white/5` 활용. 남용 금지
- **그라디언트 포인트** — 버튼·배지·일러스트에 제한적으로 사용. 배경 전체에 그라디언트 금지

## 타이포그래피

- **폰트 크기 계층 명확화** — 제목 `text-2xl font-bold`, 부제목 `text-base font-semibold`, 본문 `text-sm`으로 3단계 유지
- **자간·행간** — 제목은 `tracking-tight`, 본문은 `leading-relaxed`
- **긴 텍스트** — `max-w-prose` 또는 `max-w-[65ch]`로 가독성 확보

## 인터랙션 & 애니메이션

- **마이크로 인터랙션 필수** — 버튼·카드에 `transition-all duration-200` 이상 기본 적용
- **호버 상태 명확히** — `hover:scale-[1.02]`, `hover:shadow-lg` 등으로 클릭 가능함을 명시
- **로딩 스켈레톤** — 스피너보다 스켈레톤 UI(`animate-pulse bg-gray-200 rounded-xl`) 선호
- **페이지 전환** — 갑작스러운 등장보다 `animate-fade-in` / `translate-y` 슬라이드인
- **이징** — `ease-in-out` 대신 `ease-[cubic-bezier(0.25,0.46,0.45,0.94)]` 등 자연스러운 곡선

## 컴포넌트 패턴

- **Bottom Sheet** — 모바일에서 모달 대신 하단 슬라이드 시트
- **Command Palette** — 검색/빠른실행은 `⌘K` 스타일 인터페이스 고려
- **Floating Action** — 주요 액션 버튼은 화면 우하단 고정 FAB 패턴
- **인라인 편집** — 별도 모달보다 카드 내에서 바로 수정 가능한 인라인 편집 선호

## 다크모드

- 라이트/다크 모두 디자인 완성도를 동일하게 유지한다
- 다크모드에서 그림자 대신 `border border-white/8`로 카드 경계 표현
- 다크모드 배경이 완전한 검정(`#000`)이 되지 않도록 — `#1c1c1e` 기준 유지

## 접근성 (기본 준수)

- 인터랙티브 요소는 `min-w-11 min-h-11` (44px) 이상 터치 영역 확보
- 색상만으로 정보를 전달하지 않는다 — 아이콘·텍스트 병행
- `focus-visible:ring-2` 키보드 포커스 스타일 반드시 유지
