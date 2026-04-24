import { Suspense } from 'react';
import SocialCallbackHandler from '@/components/auth/SocialCallbackHandler';

export default function SocialCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-180px)] flex items-center justify-center">
        <p className="text-sm text-gray-400 dark:text-white/30">로그인 처리 중...</p>
      </div>
    }>
      <SocialCallbackHandler />
    </Suspense>
  );
}
