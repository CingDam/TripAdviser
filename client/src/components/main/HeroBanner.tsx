import Link from 'next/link';
import { MapPin, Sparkles } from 'lucide-react';

const HeroBanner = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-36 flex flex-col items-center text-center gap-6">
        {/* 뱃지 */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium">
          <Sparkles size={14} className="text-yellow-300" />
          AI 기반 여행 일정 플래너
        </div>

        {/* 헤드라인 */}
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
          여행 계획,<br />
          <span className="text-yellow-300">AI</span>와 함께 스마트하게
        </h1>

        {/* 서브텍스트 */}
        <p className="text-lg md:text-xl text-indigo-200 max-w-xl leading-relaxed">
          지도 위에서 바로 장소를 찾고, 드래그로 일정을 정리하고,
          AI가 최적 동선을 자동으로 정렬해드려요.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <Link
            href="/plan"
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white text-indigo-700 font-bold text-base hover:bg-indigo-50 active:scale-95 transition-all shadow-xl shadow-indigo-900/30"
          >
            <MapPin size={18} />
            지금 일정 만들기
          </Link>
          <a
            href="#popular"
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold text-base hover:bg-white/20 active:scale-95 transition-all"
          >
            인기 여행지 보기
          </a>
        </div>

        {/* 통계 */}
        <div className="flex gap-8 mt-8 pt-8 border-t border-white/10">
          {[
            { value: '1,200+', label: '등록된 여행지' },
            { value: '500+', label: '완성된 일정' },
            { value: '50+', label: '지원 도시' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-extrabold text-white">{value}</div>
              <div className="text-sm text-indigo-300 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
