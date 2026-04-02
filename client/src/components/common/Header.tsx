'use client';
import Link from 'next/link';
import { Globe, Menu, X } from 'lucide-react';
import { useState } from 'react';

const NAV_LINKS = [
  { label: '여행 계획', href: '/plan' },
  { label: '인기 여행지', href: '#popular' },
  { label: '커뮤니티', href: '#community' },
];

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm group-hover:bg-indigo-700 transition-colors">
            <Globe size={18} className="text-white" strokeWidth={2} />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-gray-900">
            Plan<span className="text-indigo-600">it</span>
          </span>
        </Link>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* 인증 버튼 */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-all"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
          >
            회원가입
          </Link>
        </div>

        {/* 모바일 햄버거 */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* 모바일 메뉴 드롭다운 */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
            >
              {label}
            </Link>
          ))}
          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
            <Link href="/login" className="flex-1 py-2 text-center rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-all">
              로그인
            </Link>
            <Link href="/signup" className="flex-1 py-2 text-center rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all">
              회원가입
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
