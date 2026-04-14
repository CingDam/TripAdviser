'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Globe, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { nestApi } from '@/config/api.config';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import Button from '@/components/common/Button';

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 ' +
  'bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white/90 ' +
  'placeholder-gray-400 dark:placeholder-white/25 text-sm outline-none ' +
  'focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white ' +
  'dark:focus:bg-white/8 transition-all';

export default function LoginForm() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { show } = useSnackbar();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await nestApi.post<{ accessToken: string }>('/auth/login', { email, pw });
      setAuth(res.data.accessToken);
      show('로그인되었습니다', 'success');
      router.push('/');
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? '로그인에 실패했습니다')
        : '로그인에 실패했습니다';
      show(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-180px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/8 rounded-3xl p-8 shadow-xl shadow-black/[0.06] dark:shadow-black/40">
          {/* 로고 */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Globe size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                Plan<span className="bg-gradient-to-r from-indigo-600 to-violet-500 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">it</span>
              </h1>
              <p className="text-sm text-gray-400 dark:text-white/35 mt-0.5">다시 만나서 반가워요</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">
                이메일
              </label>
              <input
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="비밀번호를 입력하세요"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className={`${INPUT_CLASS} pr-11`}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 transition-colors cursor-pointer"
                  aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={loading || !email || !pw}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 dark:bg-none dark:from-indigo-600 dark:to-violet-600 shadow-md shadow-indigo-500/25"
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 dark:text-white/30 mt-6">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              시작하기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
