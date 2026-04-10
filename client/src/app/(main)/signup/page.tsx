'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Globe, Check, X, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react';
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

// NIST SP 800-63B 기반 최소 복잡도 — 서버 DTO @Matches와 동일한 기준
const PW_REQUIREMENTS = [
  { label: '8자 이상',   test: (pw: string) => pw.length >= 8 },
  { label: '영문 소문자', test: (pw: string) => /[a-z]/.test(pw) },
  { label: '숫자',       test: (pw: string) => /\d/.test(pw) },
];

// 이메일 인증 단계
type VerifyStep = 'idle' | 'sent' | 'verified';

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { show } = useSnackbar();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifyStep, setVerifyStep] = useState<VerifyStep>('idle');
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [loading, setLoading] = useState(false);

  const pwMet = PW_REQUIREMENTS.map((r) => r.test(pw));
  const allPwMet = pwMet.every(Boolean);
  const pwMatch = pwConfirm.length > 0 && pw === pwConfirm;
  const pwMismatch = pwConfirm.length > 0 && pw !== pwConfirm;

  const canSubmit =
    !loading &&
    !!name &&
    verifyStep === 'verified' &&
    allPwMet &&
    pwMatch;

  // 1단계: 인증코드 발송
  const handleSendCode = async () => {
    setSendingCode(true);
    try {
      await nestApi.post('/auth/send-verification', { email });
      setVerifyStep('sent');
      setCode('');
      show('인증코드를 발송했습니다. 메일함을 확인해 주세요', 'info');
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? '발송에 실패했습니다')
        : '발송에 실패했습니다';
      show(message, 'error');
    } finally {
      setSendingCode(false);
    }
  };

  // 2단계: 코드 확인
  const handleVerifyCode = async () => {
    setVerifyingCode(true);
    try {
      await nestApi.post('/auth/verify-code', { email, code });
      setVerifyStep('verified');
      show('이메일이 인증되었습니다', 'success');
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? '인증에 실패했습니다')
        : '인증에 실패했습니다';
      show(message, 'error');
    } finally {
      setVerifyingCode(false);
    }
  };

  // 3단계: 회원가입
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allPwMet) { show('비밀번호 조건을 모두 충족해야 합니다', 'warning'); return; }
    if (pw !== pwConfirm) { show('비밀번호가 일치하지 않습니다', 'warning'); return; }

    setLoading(true);
    try {
      const res = await nestApi.post<{ accessToken: string }>('/auth/register', { name, email, pw });
      setAuth(res.data.accessToken);
      show('환영합니다! 가입이 완료되었습니다', 'success');
      router.push('/');
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? '회원가입에 실패했습니다')
        : '회원가입에 실패했습니다';
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
              <p className="text-sm text-gray-400 dark:text-white/35 mt-0.5">AI와 함께하는 스마트한 여행 계획</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 이름 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">이름</label>
              <input
                type="text"
                placeholder="이름을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
                required
                maxLength={15}
                autoComplete="name"
              />
            </div>

            {/* 이메일 + 인증코드 발송 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">이메일</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="이메일을 입력하세요"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setVerifyStep('idle'); }}
                  className={`${INPUT_CLASS} ${verifyStep === 'verified' ? 'border-emerald-400 dark:border-emerald-500' : ''}`}
                  required
                  disabled={verifyStep === 'verified'}
                  autoComplete="email"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={!email || sendingCode || verifyStep === 'verified'}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/50 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
                >
                  <Mail size={13} />
                  {sendingCode ? '발송 중' : verifyStep === 'sent' ? '재발송' : '인증코드 발송'}
                </button>
              </div>

              {/* 인증코드 입력 — 코드 발송 후 표시 */}
              {verifyStep === 'sent' && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="인증코드 6자리"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={INPUT_CLASS}
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={code.length !== 6 || verifyingCode}
                    className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {verifyingCode ? '확인 중' : '확인'}
                  </button>
                </div>
              )}

              {/* 인증 완료 배지 */}
              {verifyStep === 'verified' && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-500 dark:text-emerald-400">
                  <ShieldCheck size={13} strokeWidth={2.5} />
                  이메일 인증 완료
                </p>
              )}
            </div>

            {/* 비밀번호 — 이메일 인증 후에만 활성화 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="비밀번호를 입력하세요"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className={`${INPUT_CLASS} pr-11`}
                  required
                  disabled={verifyStep !== 'verified'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  disabled={verifyStep !== 'verified'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 disabled:opacity-30 transition-colors cursor-pointer"
                  aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pw.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {PW_REQUIREMENTS.map((req, i) => (
                    <li
                      key={req.label}
                      className={`flex items-center gap-1.5 text-xs transition-colors ${pwMet[i] ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-white/30'}`}
                    >
                      {pwMet[i] ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                      {req.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">비밀번호 확인</label>
              <div className="relative">
                <input
                  type={showPwConfirm ? 'text' : 'password'}
                  placeholder="비밀번호를 다시 입력하세요"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  className={`${INPUT_CLASS} pr-11 ${
                    pwConfirm.length > 0
                      ? pwMatch ? 'border-emerald-400 dark:border-emerald-500' : 'border-red-400 dark:border-red-500'
                      : ''
                  }`}
                  required
                  disabled={verifyStep !== 'verified'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwConfirm(!showPwConfirm)}
                  disabled={verifyStep !== 'verified'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 disabled:opacity-30 transition-colors cursor-pointer"
                  aria-label={showPwConfirm ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwMismatch && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">비밀번호가 일치하지 않습니다</p>
              )}
              {pwMatch && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-500 dark:text-emerald-400">
                  <Check size={12} strokeWidth={3} /> 비밀번호가 일치합니다
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 dark:bg-none dark:from-indigo-600 dark:to-violet-600 shadow-md shadow-indigo-500/25"
            >
              {loading ? '가입 중...' : '회원가입'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 dark:text-white/30 mt-6">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
