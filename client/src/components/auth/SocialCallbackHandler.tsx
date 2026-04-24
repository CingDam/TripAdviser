'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';

export default function SocialCallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const { setAuth } = useAuthStore();
  const { show } = useSnackbar();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setAuth(token);
      show('로그인되었습니다', 'success');
      router.replace('/');
    } else {
      show('소셜 로그인에 실패했습니다', 'error');
      router.replace('/login');
    }
  }, [params, setAuth, show, router]);

  return (
    <div className="min-h-[calc(100vh-180px)] flex items-center justify-center">
      <p className="text-sm text-gray-400 dark:text-white/30">로그인 처리 중...</p>
    </div>
  );
}
