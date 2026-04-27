'use client';

import { useEffect, useState } from 'react';

const NEST_URL = process.env.NEXT_PUBLIC_NEST_URL ?? 'http://localhost:3001';

const PROVIDERS = [
  {
    key: 'google',
    label: '구글로 계속하기',
    blockedInWebView: true,
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
    className: 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-gray-700 dark:text-white/80',
  },
  {
    key: 'kakao',
    label: '카카오로 계속하기',
    blockedInWebView: false,
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path fill="#3C1E1E" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.58 5.07 4 6.51L5.2 21l4.04-2.66c.9.17 1.82.26 2.76.26 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
      </svg>
    ),
    className: 'border-[#FEE500] bg-[#FEE500] hover:bg-[#F5DC00] text-[#3C1E1E] dark:border-[#FEE500]',
  },
  {
    key: 'naver',
    label: '네이버로 계속하기',
    blockedInWebView: true,
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path fill="#fff" d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
      </svg>
    ),
    className: 'border-[#03C75A] bg-[#03C75A] hover:bg-[#02b350] text-white dark:border-[#03C75A]',
  },
];

export default function SocialLoginButtons() {
  const [isKakaoWebView, setIsKakaoWebView] = useState(false);

  useEffect(() => {
    // 카카오톡 인앱 브라우저는 UA에 KAKAOTALK 포함 — Google/Naver OAuth 차단됨
    setIsKakaoWebView(/KAKAOTALK/i.test(navigator.userAgent));
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {isKakaoWebView && (
        <p className="text-xs text-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
          카카오톡 내 브라우저에서는 Google·Naver 로그인을 지원하지 않습니다.
          <br />
          우측 하단 <span className="font-semibold">⋯ &gt; 다른 브라우저로 열기</span>를 이용해주세요.
        </p>
      )}
      {PROVIDERS.map(({ key, label, icon, className, blockedInWebView }) => {
        const disabled = isKakaoWebView && blockedInWebView;
        return disabled ? (
          <div
            key={key}
            className={`flex items-center justify-center gap-2.5 w-full px-4 py-2.5 rounded-xl border text-sm font-semibold opacity-40 cursor-not-allowed select-none ${className}`}
          >
            {icon}
            {label}
          </div>
        ) : (
          <a
            key={key}
            href={`${NEST_URL}/api/auth/${key}`}
            className={`flex items-center justify-center gap-2.5 w-full px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${className}`}
          >
            {icon}
            {label}
          </a>
        );
      })}
    </div>
  );
}
