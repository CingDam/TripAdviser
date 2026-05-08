'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Globe, Menu, X, Sun, Moon, UserCircle, LogOut, Bell, Heart, MessageSquare } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeProvider';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from './SnackbarProvider';
import usePlanStore from '@/store/usePlanStore';
import { useNotification } from '@/hook/useNotification';

const NAV_LINKS = [
  { label: '여행 계획', href: '/plan' },
  { label: '인기 여행지', href: '/cities' },
  { label: '커뮤니티', href: '/community' },
];

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const notiRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { token, userEmail, userName, clearAuth } = useAuthStore();
  const { show } = useSnackbar();
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const setShowExitGuard = usePlanStore((s) => s.setShowExitGuard);
  const { notifications, unreadCount, markAllRead, dismiss, clearAll } = useNotification();

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

  // 알림 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setNotiOpen(false);
      }
    };
    if (notiOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [notiOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 px-4 pt-3 pb-2">
        <div
          className={`
            max-w-6xl mx-auto flex items-center
            px-4 h-14 rounded-2xl transition-all duration-300
            ${scrolled
              ? 'bg-white/90 dark:bg-black/75 backdrop-blur-2xl shadow-lg shadow-black/[0.06] dark:shadow-black/40 border border-[#DBEAFE]/70 dark:border-white/10'
              : 'bg-white/70 dark:bg-black/50 backdrop-blur-xl border border-[#DBEAFE]/40 dark:border-white/8'
            }
          `}
        >
          {/* 로고 — 플랜 페이지에서 장소가 있으면 이탈 확인 모달 트리거 */}
          <div className="flex-1">
            <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2 group w-fit">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] flex items-center justify-center shadow-md shadow-[#2563EB]/30 group-hover:shadow-[#2563EB]/50 group-hover:scale-105 transition-all duration-200">
                <Globe size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[17px] font-black tracking-tight text-gray-900 dark:text-white select-none">
                Plan<span className="bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] dark:from-[#60A5FA] dark:to-[#38BDF8] bg-clip-text text-transparent">it</span>
              </span>
            </Link>
          </div>

          {/* 데스크톱 네비게이션 — 가운데 고정 */}
          <nav className="hidden md:flex items-center gap-0.5 bg-[#EFF6FF]/80 dark:bg-white/6 rounded-xl p-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-[#0f172a]/60 dark:text-white/55 hover:text-[#0f172a] dark:hover:text-white hover:bg-white dark:hover:bg-white/10 hover:shadow-sm transition-all duration-200"
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
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[#0f172a]/40 dark:text-white/40 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-all duration-200 cursor-pointer"
              aria-label="테마 전환"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {isLoggedIn ? (
              <>
                {/* 알림 벨 */}
                <div className="relative" ref={notiRef}>
                  <button
                    onClick={() => { setNotiOpen((v) => !v); if (!notiOpen) markAllRead(); }}
                    className="relative w-9 h-9 flex items-center justify-center rounded-xl text-[#0f172a]/40 dark:text-white/40 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-all duration-200 cursor-pointer"
                    aria-label="알림"
                  >
                    <Bell size={16} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </button>

                  {notiOpen && (
                    <div className="absolute right-0 top-11 w-80 bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl border border-[#DBEAFE] dark:border-white/8 overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-[#DBEAFE]/50 dark:border-white/8 flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#0f172a] dark:text-white/90">알림</span>
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={clearAll}
                            className="text-xs text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors cursor-pointer"
                          >
                            모두 지우기
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="py-10 flex flex-col items-center gap-2 text-gray-300 dark:text-white/20">
                            <Bell size={28} strokeWidth={1.5} />
                            <span className="text-xs">새 알림이 없습니다</span>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className="group flex items-start gap-3 px-4 py-3 hover:bg-[#EFF6FF] dark:hover:bg-white/4 transition-colors cursor-pointer border-b border-[#DBEAFE]/30 dark:border-white/5 last:border-0"
                              onClick={() => { router.push(`/community/${n.communityNum}`); setNotiOpen(false); }}
                            >
                              <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${n.type === 'like' ? 'bg-red-100 dark:bg-red-500/15 text-red-500' : 'bg-[#DBEAFE] dark:bg-[#2563EB]/20 text-[#2563EB] dark:text-[#60A5FA]'}`}>
                                {n.type === 'like' ? <Heart size={13} /> : <MessageSquare size={13} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-[#0f172a]/70 dark:text-white/60 leading-relaxed">
                                  <span className="font-semibold text-[#0f172a] dark:text-white/90">{n.actorName}</span>
                                  {n.type === 'like' ? '님이 좋아요를 눌렀습니다' : '님이 댓글을 달았습니다'}
                                </p>
                                <p className="text-xs text-[#0f172a]/40 dark:text-white/30 truncate mt-0.5">{n.communityTitle}</p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/50 transition-all cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 유저네임 클릭 시 마이페이지로 이동 */}
                <Link
                  href="/mypage"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-[#0f172a]/50 dark:text-white/45 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-all duration-200"
                >
                  <UserCircle size={16} />
                  {userName}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium text-[#0f172a]/35 dark:text-white/35 hover:text-red-500 dark:hover:text-red-400 hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-all duration-200 cursor-pointer"
                >
                  <LogOut size={14} />
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-1.5 rounded-xl text-sm font-medium text-[#0f172a]/50 dark:text-white/45 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-all duration-200"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:scale-95 transition-all duration-200 shadow-md shadow-[#2563EB]/30 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
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
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[#0f172a]/40 dark:text-white/40 hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-colors cursor-pointer"
              aria-label="테마 전환"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#EFF6FF] dark:bg-white/8 text-[#0f172a]/60 dark:text-white/60 hover:bg-[#DBEAFE]/50 dark:hover:bg-white/12 transition-colors cursor-pointer"
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
            bg-white/97 dark:bg-[#2c2c2e]/95 backdrop-blur-2xl
            border border-[#DBEAFE]/60 dark:border-white/10
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
                className="px-4 py-3 rounded-xl text-sm font-medium text-[#0f172a]/60 dark:text-white/60 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-all"
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="px-2.5 pb-2.5 flex gap-2 border-t border-[#DBEAFE]/50 dark:border-white/8 pt-2">
            {isLoggedIn ? (
              <>
                <Link
                  href="/mypage"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm text-[#0f172a]/50 dark:text-white/45 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-all"
                >
                  <UserCircle size={15} />
                  {userEmail}
                </Link>
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="flex-1 py-2.5 text-center rounded-xl text-sm font-semibold border border-[#DBEAFE] dark:border-white/10 text-red-400 hover:border-red-300 dark:hover:border-red-500/40 transition-all cursor-pointer"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl text-sm font-semibold border border-[#DBEAFE] dark:border-white/10 text-[#0f172a]/60 dark:text-white/60 hover:border-[#2563EB] dark:hover:border-white/20 hover:text-[#0f172a] dark:hover:text-white transition-all"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl text-sm font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-md shadow-[#2563EB]/25 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA] transition-all"
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
