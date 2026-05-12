'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e] flex flex-col items-center justify-center gap-6 px-4">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
        <AlertTriangle size={28} className="text-red-500 dark:text-red-400" strokeWidth={1.5} />
      </div>

      <div className="text-center flex flex-col gap-1.5">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white/90">
          문제가 발생했습니다
        </h1>
        <p className="text-sm text-gray-400 dark:text-white/35">
          일시적인 오류입니다. 다시 시도해 주세요.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-all cursor-pointer"
        >
          <RotateCcw size={13} />
          다시 시도
        </button>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-white/8 text-gray-500 dark:text-white/40 hover:text-gray-800 dark:hover:text-white/70 transition-all cursor-pointer"
        >
          <Home size={13} />
          홈으로
        </button>
      </div>
    </main>
  );
}
