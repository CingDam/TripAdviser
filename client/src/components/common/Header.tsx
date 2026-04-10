'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, Menu, X, Sun, Moon, UserCircle, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from './ThemeProvider';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from './SnackbarProvider';

const NAV_LINKS = [
  { label: '여행 계획', href: '/plan' },
  { label: '인기 여행지', href: '#popular' },
  { label: '커뮤니티', href: '#community' },
];

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const { token, userEmail, userName, clearAuth } = useAuthStore();
  const { show } = useSnackbar();

  // localStorage hydration 후 인증 상태 표시 — SSR에서는 token이 null이므로 mounted 후에만 렌더
  useEffect(() => { setMounted(true); }, []);

  const isLoggedIn = mounted && !!token;

  const handleLogout = () => {
    clearAuth();
    show('로그아웃되었습니다', 'info');
    router.push('/');
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  console.log(useAuthStore());

  return (
    <>
      <header className="sticky top-0 z-50 px-4 pt-3 pb-2">
        <div
          className={`
            max-w-6xl mx-auto flex items-center justify-between
            px-4 h-14 rounded-2xl transition-all duration-300
            ${scrolled
              ? 'bg-white/85 dark:bg-black/75 backdrop-blur-2xl shadow-lg shadow-black/[0.06] dark:shadow-black/40 border border-gray-200/60 dark:border-white/10'
              : 'bg-white/65 dark:bg-black/50 backdrop-blur-xl border border-gray-200/40 dark:border-white/8'
            }
          `}
        >
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30 group-hover:shadow-indigo-500/50 group-hover:scale-105 transition-all duration-200">
              <Globe size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[17px] font-black tracking-tight text-gray-900 dark:text-white select-none">
              Plan<span className="bg-gradient-to-r from-indigo-600 to-violet-500 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">it</span>
            </span>
          </Link>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center gap-0.5 bg-gray-100/80 dark:bg-white/6 rounded-xl p-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-white/55 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 hover:shadow-sm transition-all duration-200"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* 우측 버튼 그룹 */}
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {/* 다크모드 토글 */}
            <button
              onClick={toggle}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/8 transition-all duration-200 cursor-pointer"
              aria-label="테마 전환"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {isLoggedIn ? (
              <>
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 dark:text-white/45">
                  <UserCircle size={16} />
                  {userName}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium text-gray-400 dark:text-white/35 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100/80 dark:hover:bg-white/8 transition-all duration-200 cursor-pointer"
                >
                  <LogOut size={14} />
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-1.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/45 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/8 transition-all duration-200"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-90 active:scale-95 transition-all duration-200 shadow-md shadow-indigo-500/25"
                >
                  시작하기
                </Link>
              </>
            )}
          </div>

          {/* 모바일 우측 */}
          <div className="md:hidden flex items-center gap-1.5">
            <button
              onClick={toggle}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 dark:text-white/40 hover:bg-gray-100/80 dark:hover:bg-white/8 transition-colors cursor-pointer"
              aria-label="테마 전환"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100/80 dark:bg-white/8 text-gray-600 dark:text-white/60 hover:bg-gray-200/80 dark:hover:bg-white/12 transition-colors cursor-pointer"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 오버레이 메뉴 */}
      <div
        className={`
          fixed inset-0 z-40 md:hidden transition-all duration-300
          ${menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      >
        <div
          className="absolute inset-0 bg-black/10 dark:bg-black/50 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />

        <div
          className={`
            absolute top-[72px] left-4 right-4 rounded-2xl overflow-hidden
            bg-white/95 dark:bg-[#2c2c2e]/95 backdrop-blur-2xl
            border border-gray-200/60 dark:border-white/10
            shadow-2xl shadow-black/8 dark:shadow-black/60
            transition-all duration-300
            ${menuOpen ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'}
          `}
        >
          <div className="p-2.5 flex flex-col gap-0.5">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/8 transition-all"
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="px-2.5 pb-2.5 flex gap-2 border-t border-gray-100 dark:border-white/8 pt-2">
            {isLoggedIn ? (
              <>
                <span className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-gray-500 dark:text-white/45">
                  <UserCircle size={15} />
                  {userEmail}
                </span>
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="flex-1 py-2.5 text-center rounded-xl text-sm font-semibold border border-gray-200 dark:border-white/10 text-red-400 hover:border-red-300 dark:hover:border-red-500/40 transition-all cursor-pointer"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl text-sm font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-gray-300 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-white transition-all"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
                >
                  시작하기
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
