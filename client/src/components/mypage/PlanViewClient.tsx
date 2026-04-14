'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Globe, Lock, Calendar } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import { nestApi } from '@/config/api.config';
import { getTag } from '@/utils/placeUtils';
import { DAY_COLORS } from '@/constants/dayColors';

interface DayPlanItem {
  dayPlanNum: number;
  planDate: string;
  sortOrder: number;
  placeId: string | null;
  locationName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  tel: string | null;
}

interface PlanDetail {
  planNum: number;
  planName: string;
  startDate: string | null;
  endDate: string | null;
  isPublic: number;
  city: { cityName: string; country: string } | null;
  dayPlans: DayPlanItem[];
  createdAt: string;
}

// 날짜별로 그룹핑 + 정렬
function groupByDate(dayPlans: DayPlanItem[]): { date: string; places: DayPlanItem[] }[] {
  const map = new Map<string, DayPlanItem[]>();
  const sorted = [...dayPlans].sort((a, b) => {
    if (a.planDate !== b.planDate) return a.planDate.localeCompare(b.planDate);
    return a.sortOrder - b.sortOrder;
  });
  for (const item of sorted) {
    if (!map.has(item.planDate)) map.set(item.planDate, []);
    map.get(item.planDate)!.push(item);
  }
  return Array.from(map.entries()).map(([date, places]) => ({ date, places }));
}

const PlanViewClient = ({ planNum }: { planNum: number }) => {
  const router = useRouter();
  const { show } = useSnackbar();
  const { token } = useAuthStore();

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }
    nestApi
      .get<PlanDetail>(`/plan/${planNum}`)
      .then((res) => setPlan(res.data))
      .catch(() => {
        show('일정을 불러오지 못했습니다', 'error');
        router.replace('/mypage');
      })
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, planNum]);

  if (!token) return null;

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e]">
        <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-6">
          <div className="skeleton h-8 rounded-full w-1/3" />
          <div className="skeleton h-6 rounded-full w-1/2" />
          <div className="skeleton h-48 rounded-2xl w-full" />
          <div className="skeleton h-48 rounded-2xl w-full" />
        </div>
      </main>
    );
  }

  if (!plan) return null;

  const grouped = groupByDate(plan.dayPlans.filter((dp) => dp.placeId !== null));
  const totalPlaces = grouped.reduce((acc, g) => acc + g.places.length, 0);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e]">
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-6">

        {/* 뒤로 가기 */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-white/35 hover:text-gray-700 dark:hover:text-white/70 transition-colors cursor-pointer w-fit"
        >
          <ArrowLeft size={15} />
          내 일정으로
        </button>

        {/* 플랜 헤더 카드 */}
        <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-6 border border-gray-100 dark:border-white/8 shadow-sm flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white/90 leading-tight">
              {plan.planName}
            </h1>
            <span
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold flex-shrink-0 mt-1
                ${plan.isPublic
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400'
                  : 'bg-gray-100 dark:bg-white/8 text-gray-400 dark:text-white/30'
                }`}
            >
              {plan.isPublic ? <Globe size={9} /> : <Lock size={9} />}
              {plan.isPublic ? '공개' : '비공개'}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-400 dark:text-white/35">
            {plan.startDate && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                {plan.startDate}
                {plan.endDate && plan.endDate !== plan.startDate && ` ~ ${plan.endDate}`}
              </span>
            )}
            {plan.city && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />
                {plan.city.cityName} · {plan.city.country}
              </span>
            )}
            <span>{grouped.length}일 · 장소 {totalPlaces}개</span>
          </div>
        </div>

        {/* 날짜별 일정 */}
        {grouped.length === 0 ? (
          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-gray-100 dark:border-white/8 p-12 flex flex-col items-center gap-2 text-gray-300 dark:text-white/20">
            <MapPin size={36} strokeWidth={1.5} />
            <span className="text-sm">저장된 장소가 없습니다</span>
          </div>
        ) : (
          grouped.map(({ date, places }, dayIndex) => {
            const color = DAY_COLORS[dayIndex % DAY_COLORS.length];
            return (
              <div key={date} className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-gray-100 dark:border-white/8 shadow-sm overflow-hidden">
                {/* Day 헤더 */}
                <div
                  className="px-5 py-3 text-sm font-bold"
                  style={{ color, borderBottom: `1px solid ${color}22`, background: `${color}08` }}
                >
                  Day {dayIndex + 1} · {date}
                </div>

                {/* 장소 타임라인 */}
                <div className="px-5 py-4 flex flex-col">
                  {places.map((item, index) => {
                    const isLast = index === places.length - 1;
                    const tag = getTag([]);  // placeId 기반 타입 정보는 저장 안 돼 있음 — 빈 배열 전달
                    return (
                      <div key={item.dayPlanNum} className="flex gap-3">
                        {/* 번호 원 + 연결선 */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: color }}
                          >
                            {index + 1}
                          </div>
                          {!isLast && (
                            <div className="w-0.5 flex-1 min-h-5 my-1" style={{ background: `${color}44` }} />
                          )}
                        </div>

                        {/* 장소 정보 */}
                        <div className={`flex-1 min-w-0 ${isLast ? 'pb-1' : 'pb-4'}`}>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
                            {item.locationName ?? '(이름 없음)'}
                          </p>
                          {item.address && (
                            <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 truncate">
                              {item.address}
                            </p>
                          )}
                          {tag && (
                            <span
                              className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold"
                              style={{ background: tag.color + '22', color: tag.color }}
                            >
                              {tag.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
};

export default PlanViewClient;
