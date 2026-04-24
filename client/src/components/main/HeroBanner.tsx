import { Sparkles } from 'lucide-react';
import CitySearchModal from './CitySearchModal';

const HeroBanner = () => {
  return (
    <section className="relative overflow-hidden bg-gray-50 dark:bg-[#1c1c1e] text-gray-900 dark:text-white">

      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 라이트: 부드러운 컬러 블러 / 다크: 어두운 글로우 */}
        <div className="absolute -top-40 -left-32 w-[500px] h-[500px] rounded-full bg-indigo-100/60 dark:bg-violet-700/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-24 w-[480px] h-[480px] rounded-full bg-violet-100/60 dark:bg-indigo-700/20 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] rounded-full bg-indigo-50/80 dark:bg-indigo-900/10 blur-[80px]" />

        {/* 노이즈 텍스처 */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '128px',
          }}
        />

        {/* 하단 구분선 */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-28 md:py-40 flex flex-col items-center text-center gap-6">

        {/* 뱃지 */}
        <div
          className="hero-animate flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-gray-200/80 dark:border-white/10 text-sm font-medium text-gray-500 dark:text-white/70 shadow-sm dark:shadow-none"
          style={{ animationDelay: '0ms' }}
        >
          <Sparkles size={13} className="text-violet-500 dark:text-violet-400" />
          AI 기반 여행 일정 플래너
        </div>

        {/* 헤드라인 */}
        <h1
          className="hero-animate text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight text-gray-900 dark:text-white"
          style={{ animationDelay: '120ms' }}
        >
          여행 계획,<br />
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
            AI
          </span>
          와 함께 스마트하게
        </h1>

        {/* 서브텍스트 */}
        <p
          className="hero-animate text-base md:text-lg text-gray-500 dark:text-white/45 max-w-lg leading-relaxed"
          style={{ animationDelay: '240ms' }}
        >
          지도 위에서 바로 장소를 찾고, 드래그로 일정을 정리하고,
          AI가 최적 동선을 자동으로 정렬해드려요.
        </p>

        {/* CTA */}
        <div
          className="hero-animate flex flex-col sm:flex-row gap-3 mt-2"
          style={{ animationDelay: '360ms' }}
        >
          <CitySearchModal />
          <a
            href="#popular"
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white dark:bg-white/6 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 active:scale-95 transition-all"
          >
            인기 여행지 보기
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
