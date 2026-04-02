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
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-gray-800">

          {/* 브랜드 */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                <Globe size={18} className="text-white" strokeWidth={2} />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">
                Plan<span className="text-indigo-400">it</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500">
              AI와 함께하는 스마트한<br />여행 일정 플래너
            </p>
            {/* 소셜 링크 */}
            <div className="flex gap-3 mt-4">
              <a href="#" className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-indigo-600 transition-colors">
                <Mail size={14} />
              </a>
            </div>
          </div>

          {/* 링크 그룹 */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>
              <ul className="flex flex-col gap-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-gray-500 hover:text-indigo-400 transition-colors"
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
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-gray-600">
          <span>© 2026 Planit. All rights reserved.</span>
          <span>Made with ♥ for travelers</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
