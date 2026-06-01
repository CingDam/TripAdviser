'use client';
import { Link, Unlink } from 'lucide-react';
import Button from '@/components/common/Button';

export interface SocialLinkInfo {
  provider: 'google' | 'kakao' | 'naver';
  createdAt: string;
}

const SOCIAL_PROVIDERS = [
  {
    key: 'google' as const,
    label: '구글',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
  {
    key: 'kakao' as const,
    label: '카카오',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path fill="#3C1E1E" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.58 5.07 4 6.51L5.2 21l4.04-2.66c.9.17 1.82.26 2.76.26 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
      </svg>
    ),
  },
  {
    key: 'naver' as const,
    label: '네이버',
    icon: (
      <div className="w-5 h-5 bg-[#03C75A] rounded flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
          <path fill="#fff" d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
        </svg>
      </div>
    ),
  },
];

// 연동 시작 후 OAuth 리다이렉트 처리는 호출부(MyPageClient)가 담당 — 여기선 표시·트리거만
export function getProviderLabel(provider: string): string {
  return SOCIAL_PROVIDERS.find((p) => p.key === provider)?.label ?? provider;
}

interface SocialLinkSectionProps {
  socialLinks: SocialLinkInfo[];
  linkingProvider: string | null;
  onLink: (provider: string) => void;
  onUnlink: (provider: string) => void;
}

export default function SocialLinkSection({ socialLinks, linkingProvider, onLink, onUnlink }: SocialLinkSectionProps) {
  return (
    <section className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-6 border border-gray-100 dark:border-white/8 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link size={16} className="text-gray-400 dark:text-white/30" />
        <h2 className="text-base font-bold text-gray-900 dark:text-white/90">소셜 계정 연동</h2>
      </div>
      <div className="flex flex-col gap-3">
        {SOCIAL_PROVIDERS.map(({ key, label, icon }) => {
          const linked = socialLinks.find((l) => l.provider === key);
          const isLinking = linkingProvider === key;

          return (
            <div key={key} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                {icon}
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-white/70">
                    {label}
                  </span>
                  {linked && (
                    <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">
                      {new Date(linked.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 연동
                    </p>
                  )}
                </div>
                {linked && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 font-bold">
                    연동됨
                  </span>
                )}
              </div>
              {linked ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUnlink(key)}
                  className="flex items-center gap-1 text-gray-400 hover:text-red-500"
                >
                  <Unlink size={12} />
                  해제
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onLink(key)}
                  disabled={isLinking}
                  className="flex items-center gap-1"
                >
                  {isLinking ? (
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                  ) : (
                    <Link size={12} />
                  )}
                  {isLinking ? '연결 중' : '연동'}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
