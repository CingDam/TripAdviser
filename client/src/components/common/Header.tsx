'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Globe, Menu, X, Sun, Moon, UserCircle, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from './ThemeProvider';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from './SnackbarProvider';
import usePlanStore from '@/store/usePlanStore';

const NAV_LINKS = [
  { label: '여행 계획', href: '/plan' },
  { label: '인기 여행지', href: '/cities' },
  { label: '커뮤니티', href: '/community' },
];

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { token, userEmail, userName, clearAuth } = useAuthStore();
  const { show } = useSnackbar();
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const setShowExitGuard = usePlanStore((s) => s.setShowExitGuard);

  // localStorage hydration 후 인증 상태 표시 — SSR에서는 token이 null이므로 mounted 후에만 렌더
  useEffect(() => { setMounted(true); }, []);

  const isLoggedIn = mounted && !!token;

  // 플랜 페이지에서 날짜 또는 장소가 있을 때 로고 클릭 시 이탈 확인 모달 표시
  const isOnPlanPage = pathname === '/plan';
  const hasPlanData = isOnPlanPage && dayPlans.length > 0;

  const handleLogoClick = (e: React.MouseEvent) => {
    if (hasPlanData) {
      e.preventDefault();
      setShowExitGuard(true);
    }
  };

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

  return (
    <>
      <header className="sticky top-0 z-50 px-4 pt-3 pb-2">
        <div
          className={`
            max-w-6xl mx-auto flex items-center
            px-4 h-14 rounded-2xl transition-all duration-300
            ${scrolled
              ? 'bg-[#FBFBFB]/90 dark:bg-black/75 backdrop-blur-2xl shadow-lg shadow-black/[0.06] dark:shadow-black/40 border border-[#C4D9FF]/70 dark:border-white/10'
              : 'bg-[#FBFBFB]/70 dark:bg-black/50 backdrop-blur-xl border border-[#C4D9FF]/40 dark:border-white/8'
            }
          `}
        >
          {/* 로고 — 플랜 페이지에서 장소가 있으면 이탈 확인 모달 트리거 */}
          <div className="flex-1">
            <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2 group w-fit">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/30 group-hover:shadow-rose-500/50 group-hover:scale-105 transition-all duration-200">
                <Globe size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[17px] font-black tracking-tight text-gray-900 dark:text-white select-none">
                Plan<span className="bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-400 dark:to-pink-400 bg-clip-text text-transparent">it</span>
              </span>
            </Link>
          </div>

          {/* 데스크톱 네비게이션 — 가운데 고정 */}
          <nav className="hidden md:flex items-center gap-0.5 bg-[#E8F9FF]/80 dark:bg-white/6 rounded-xl p-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-[#1a1a2e]/60 dark:text-white/55 hover:text-[#1a1a2e] dark:hover:text-white hover:bg-white dark:hover:bg-white/10 hover:shadow-sm transition-all duration-200"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* 우측 버튼 그룹 */}
          <div className="hidden md:flex flex-1 items-center justify-end gap-1.5">
            {/* 다크모드 토글 */}
            <button
              onClick={toggle}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[#1a1a2e]/40 dark:text-white/40 hover:text-[#1a1a2e] dark:hover:text-white hover:bg-[#E8F9FF] dark:hover:bg-white/8 transition-all duration-200 cursor-pointer"
              aria-label="테마 전환"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {isLoggedIn ? (
              <>
                {/* 유저네임 클릭 시 마이페이지로 이동 */}
                <Link
                  href="/mypage"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-[#1a1a2e]/50 dark:text-white/45 hover:text-[#1a1a2e] dark:hover:text-white hover:bg-[#E8F9FF] dark:hover:bg-white/8 transition-all duration-200"
                >
                  <UserCircle size={16} />
                  {userName}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium text-[#1a1a2e]/35 dark:text-white/35 hover:text-red-500 dark:hover:text-red-400 hover:bg-[#E8F9FF] dark:hover:bg-white/8 transition-all duration-200 cursor-pointer"
                >
                  <LogOut size={14} />
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-1.5 rounded-xl text-sm font-medium text-[#1a1a2e]/50 dark:text-white/45 hover:text-[#1a1a2e] dark:hover:text-white hover:bg-[#E8F9FF] dark:hover:bg-white/8 transition-all duration-200"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-[#C5BAFF] text-[#1a1a2e] hover:bg-[#AEA2F5] active:scale-95 transition-all duration-200 shadow-md shadow-[#C5BAFF]/40 dark:bg-[#A89AFF] dark:hover:bg-[#9488F0]"
                >
                  시작하기
                </Link>
              </>
            )}
          </div>

          {/* 모바일 우측 */}
          <div className="md:hidden flex flex-1 items-center justify-end gap-1.5">
            <button
              onClick={toggle}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[#1a1a2e]/40 dark:text-white/40 hover:bg-[#E8F9FF] dark:hover:bg-white/8 transition-colors cursor-pointer"
              aria-label="테마 전환"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#E8F9FF] dark:bg-white/8 text-[#1a1a2e]/60 dark:text-white/60 hover:bg-[#C4D9FF]/50 dark:hover:bg-white/12 transition-colors cursor-pointer"
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
            bg-[#FBFBFB]/97 dark:bg-[#2c2c2e]/95 backdrop-blur-2xl
            border border-[#C4D9FF]/60 dark:border-white/10
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
                className="px-4 py-3 rounded-xl text-sm font-medium text-[#1a1a2e]/60 dark:text-white/60 hover:text-[#1a1a2e] dark:hover:text-white hover:bg-[#E8F9FF] dark:hover:bg-white/8 transition-all"
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="px-2.5 pb-2.5 flex gap-2 border-t border-[#C4D9FF]/50 dark:border-white/8 pt-2">
            {isLoggedIn ? (
              <>
                <Link
                  href="/mypage"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm text-[#1a1a2e]/50 dark:text-white/45 hover:text-[#1a1a2e] dark:hover:text-white hover:bg-[#E8F9FF] dark:hover:bg-white/8 transition-all"
                >
                  <UserCircle size={15} />
                  {userEmail}
                </Link>
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="flex-1 py-2.5 text-center rounded-xl text-sm font-semibold border border-[#C4D9FF] dark:border-white/10 text-red-400 hover:border-red-300 dark:hover:border-red-500/40 transition-all cursor-pointer"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl text-sm font-semibold border border-[#C4D9FF] dark:border-white/10 text-[#1a1a2e]/60 dark:text-white/60 hover:border-[#C5BAFF] dark:hover:border-white/20 hover:text-[#1a1a2e] dark:hover:text-white transition-all"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl text-sm font-semibold bg-[#C5BAFF] text-[#1a1a2e] hover:bg-[#AEA2F5] shadow-md shadow-[#C5BAFF]/30 dark:bg-[#A89AFF] dark:hover:bg-[#9488F0] transition-all"
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
