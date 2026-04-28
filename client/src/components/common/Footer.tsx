import Link from 'next/link';
import { Globe, Mail } from 'lucide-react';

const FOOTER_LINKS = {
  서비스: [
    { label: '여행 계획 만들기', href: '/plan' },
    { label: '인기 여행지', href: '#popular' },
    { label: '커뮤니티', href: '#community' },
  ],
  지원: [
    { label: '공지사항', href: '#' },
    { label: '자주 묻는 질문', href: '#' },
    { label: '문의하기', href: '#' },
  ],
  약관: [
    { label: '서비스 이용약관', href: '#' },
    { label: '개인정보 처리방침', href: '#' },
  ],
};

const Footer = () => {
  return (
    <footer className="bg-[#1a1a2e] dark:bg-[#1c1c1e] text-[#C4D9FF]/50 dark:text-white/40 border-t border-[#C4D9FF]/10 dark:border-white/6">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#C4D9FF]/10 dark:border-white/6">

          {/* 브랜드 */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/20">
                <Globe size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[17px] font-black tracking-tight text-white select-none">
                Plan<span className="bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">it</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-white/35">
              AI와 함께하는 스마트한<br />여행 일정 플래너
            </p>
            <div className="flex gap-2 mt-4">
              <a href="#" className="w-8 h-8 rounded-lg bg-[#C4D9FF]/10 dark:bg-white/6 flex items-center justify-center hover:bg-[#C4D9FF]/20 dark:hover:bg-white/12 transition-colors">
                <Mail size={14} className="text-[#C4D9FF]/60 dark:text-white/50" />
              </a>
            </div>
          </div>

          {/* 링크 그룹 */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-[#E8F9FF]/80 dark:text-white/70 mb-3">{title}</h4>
              <ul className="flex flex-col gap-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-[#C4D9FF]/40 dark:text-white/35 hover:text-[#C5BAFF] dark:hover:text-[#A89AFF] transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 카피라이트 */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-[#C4D9FF]/25 dark:text-white/20">
          <span>© 2026 Planit. All rights reserved.</span>
          <span>Made with ♥ for travelers</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
