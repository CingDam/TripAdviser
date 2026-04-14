# 렌더링 전략 규칙 (SSR / CSR)

Next.js App Router에서 모든 컴포넌트는 기본적으로 **서버 컴포넌트(SC)**다.
`'use client'`는 꼭 필요한 최하위 컴포넌트에만 붙인다.

## 핵심 원칙

`page.tsx` / `layout.tsx`에 `'use client'`를 직접 붙이지 않는다.
인터랙티브 로직(useState, 이벤트 핸들러, 브라우저 API)은 별도 클라이언트 컴포넌트로 분리하고,
`page.tsx`는 그 컴포넌트를 import해서 렌더한다.

```tsx
// X — page.tsx 전체가 CSR로 떨어짐
'use client';
export default function LoginPage() {
  const [email, setEmail] = useState('');
  ...
}

// O — page.tsx는 SC, 인터랙션은 하위 CC에 위임
// app/(main)/login/page.tsx
import LoginForm from './LoginForm';
export default function LoginPage() {
  return <LoginForm />;
}

// app/(main)/login/LoginForm.tsx
'use client';
export default function LoginForm() {
  const [email, setEmail] = useState('');
  ...
}
```

## SC / CC 역할 구분

| 역할 | SC (서버 컴포넌트) | CC (클라이언트 컴포넌트) |
|---|---|---|
| **데이터 페칭** | fetch, DB 직접 조회 | SWR / React Query (필요 시) |
| **상태** | 없음 | useState, Zustand |
| **이벤트** | 없음 | onClick, onChange 등 |
| **브라우저 API** | 없음 | window, document |
| **예시** | page.tsx, layout.tsx | Form, Modal, Carousel |

## 파일 배치 규칙

`app/` 디렉터리에는 라우트 파일(`page.tsx`, `layout.tsx`, `loading.tsx` 등)만 둔다.
CC는 도메인별로 `components/` 하위에 분리한다.

```
app/(main)/login/
└── page.tsx                     ← SC (라우트 파일만)

app/(main)/signup/
└── page.tsx                     ← SC

components/
└── auth/
    ├── LoginForm.tsx             ← CC ('use client')
    └── SignupForm.tsx            ← CC ('use client')
```

## ISR (Incremental Static Regeneration)

정적 콘텐츠이지만 주기적 갱신이 필요한 페이지에 사용한다.

```tsx
// 1시간마다 재생성 — 환율·인기 여행지 등 빈번하지 않게 바뀌는 데이터
export const revalidate = 3600;
```

`revalidate = 0` 은 SSR(매 요청마다 생성)과 동일하므로 ISR이 아님에 주의.
