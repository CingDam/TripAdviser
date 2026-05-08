'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Globe } from 'lucide-react';
import { nestApi } from '@/config/api.config';

interface PublicPlanCard {
  planNum: number;
  planName: string;
  startDate: string | null;
  endDate: string | null;
  user: { name: string };
  city: { cityName: string; country: string; imageUrl: string | null } | null;
  dayPlans: { dayPlanNum: number }[];
}

interface Props {
  cityNum?: number;
  title?: string;
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return '날짜 미정';
  if (!end || start === end) return start;
  const s = start.slice(5);
  const e = end.slice(5);
  return `${s} ~ ${e}`;
}

const SkeletonCard = () => (
  <div className="flex-shrink-0 w-52 bg-white dark:bg-[#2c2c2e] rounded-2xl overflow-hidden border border-[#DBEAFE]/50 dark:border-white/8">
    <div className="skeleton h-28 w-full" />
    <div className="p-3 flex flex-col gap-2">
      <div className="skeleton h-3.5 w-3/4 rounded-full" />
      <div className="skeleton h-3 w-1/2 rounded-full" />
      <div className="skeleton h-3 w-2/3 rounded-full" />
    </div>
  </div>
);

export default function PublicPlanSlider({ cityNum, title = '공유된 일정' }: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [plans, setPlans] = useState<PublicPlanCard[]>([]);
  const [sort, setSort] = useState<'latest' | 'places'>('latest');
  const [isLoading, setIsLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    void nestApi
      .get<PublicPlanCard[]>('/plan/public', {
        params: { sort, limit: 20, ...(cityNum && { cityNum }) },
      })
      .then((res) => setPlans(res.data))
      .catch(() => setPlans([]))
      .finally(() => setIsLoading(false));
  }, [sort, cityNum]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollButtons);
  }, [plans, updateScrollButtons]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  if (!isLoading && plans.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white/80">{title}</h2>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/6 rounded-xl p-1">
          {(['latest', 'places'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer
                ${sort === s
                  ? 'bg-white dark:bg-[#3a3a3c] text-[#2563EB] dark:text-[#60A5FA] shadow-sm'
                  : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'
                }`}
            >
              {s === 'latest' ? '최신순' : '장소 많은순'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* 왼쪽 화살표 */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 rounded-full bg-white dark:bg-[#2c2c2e] border border-[#DBEAFE] dark:border-white/10 shadow-md flex items-center justify-center text-gray-500 dark:text-white/50 hover:text-[#2563EB] dark:hover:text-[#60A5FA] transition-all cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            : plans.map((plan) => (
                <button
                  key={plan.planNum}
                  type="button"
                  onClick={() => router.push(`/plan/view/${plan.planNum}`)}
                  className="flex-shrink-0 w-52 bg-white dark:bg-[#2c2c2e] rounded-2xl overflow-hidden border border-[#DBEAFE]/50 dark:border-white/8 hover:border-[#2563EB]/40 dark:hover:border-white/15 hover:shadow-md transition-all cursor-pointer text-left group"
                >
                  {/* 썸네일 */}
                  <div className="h-28 relative overflow-hidden bg-gradient-to-br from-[#DBEAFE] to-[#EFF6FF] dark:from-[#1e3a5f] dark:to-[#1c2e4a]">
                    {plan.city?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={plan.city.imageUrl}
                        alt={plan.city.cityName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Globe size={28} className="text-[#2563EB]/30 dark:text-white/15" />
                      </div>
                    )}
                    {/* 장소 수 배지 */}
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {plan.dayPlans.length}곳
                    </div>
                  </div>

                  {/* 정보 */}
                  <div className="p-3 flex flex-col gap-1.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-white/90 line-clamp-1 group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors">
                      {plan.planName}
                    </p>
                    {plan.city && (
                      <p className="text-xs text-[#2563EB] dark:text-[#60A5FA] flex items-center gap-1 font-medium">
                        <MapPin size={10} />
                        {plan.city.cityName}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-white/30 flex items-center gap-1">
                      <CalendarDays size={10} />
                      {formatPeriod(plan.startDate, plan.endDate)}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-white/25 mt-0.5">
                      by {plan.user.name}
                    </p>
                  </div>
                </button>
              ))}
        </div>

        {/* 오른쪽 화살표 */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 rounded-full bg-white dark:bg-[#2c2c2e] border border-[#DBEAFE] dark:border-white/10 shadow-md flex items-center justify-center text-gray-500 dark:text-white/50 hover:text-[#2563EB] dark:hover:text-[#60A5FA] transition-all cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}
