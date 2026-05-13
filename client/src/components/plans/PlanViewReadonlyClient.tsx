'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { ArrowLeft, CalendarDays, MapPin, User, Lock, Share2, Copy } from 'lucide-react';
import { nestApi } from '@/config/api.config';
import { DAY_COLORS } from '@/constants/dayColors';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import { useAuthStore } from '@/store/useAuthStore';

interface DayPlanItem {
  dayPlanNum: number;
  planDate: string;
  sortOrder: number;
  locationName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
}

interface PublicPlan {
  planNum: number;
  planName: string;
  startDate: string | null;
  endDate: string | null;
  isPublic: number;
  user: { userNum: number; name: string };
  city: { cityName: string; country: string } | null;
  dayPlans: DayPlanItem[];
}

const DEFAULT_CENTER = { lat: 37.5516, lng: 126.9886 };

// 날짜 배열에서 고유 날짜만 추출 — 일자별 탭 구성용
function uniqueDates(dayPlans: DayPlanItem[]): string[] {
  return Array.from(new Set(dayPlans.map((d) => d.planDate)));
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return '날짜 미정';
  if (!end || start === end) return start;
  return `${start} ~ ${end}`;
}

// 지도에 폴리라인 그리기 — 선택 날짜의 장소를 순서대로 연결
function PolylinePath({ path, color }: { path: { lat: number; lng: number }[]; color: string }) {
  const map = useMap();
  useEffect(() => {
    if (!map || path.length < 2) return;
    const polyline = new google.maps.Polyline({
      path,
      strokeColor: color,
      strokeWeight: 3,
      strokeOpacity: 0.7,
      map,
    });
    return () => polyline.setMap(null);
  }, [map, path, color]);
  return null;
}

// 지도 초기 중심 — 첫 번째 유효 장소로 이동
function MapCenterSetter({ places }: { places: DayPlanItem[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const first = places.find((p) => p.lat && p.lng);
    if (first?.lat && first?.lng) {
      map.panTo({ lat: first.lat, lng: first.lng });
      map.setZoom(13);
    }
  }, [map, places]);
  return null;
}

function PlanViewMap({
  plan,
  selectedDate,
  focusedDayPlanNum,
}: {
  plan: PublicPlan;
  selectedDate: string | null;
  focusedDayPlanNum: number | null;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  // 장소 카드 클릭 시 지도 중심 이동
  useEffect(() => {
    if (!map || focusedDayPlanNum === null) return;
    const place = plan.dayPlans.find((p) => p.dayPlanNum === focusedDayPlanNum);
    if (place?.lat && place?.lng) {
      map.panTo({ lat: place.lat, lng: place.lng });
      map.setZoom(15);
    }
  }, [map, focusedDayPlanNum, plan.dayPlans]);

  const placesForDate = useMemo(
    () =>
      selectedDate
        ? plan.dayPlans.filter((d) => d.planDate === selectedDate && d.lat && d.lng)
        : plan.dayPlans.filter((d) => d.lat && d.lng),
    [plan.dayPlans, selectedDate],
  );

  const dates = uniqueDates(plan.dayPlans);
  const dateColorMap = useMemo(
    () => Object.fromEntries(dates.map((d, i) => [d, DAY_COLORS[i % DAY_COLORS.length]])),
    [dates],
  );

  const polylinePath = useMemo(
    () =>
      placesForDate
        .filter((p) => p.lat && p.lng)
        .map((p) => ({ lat: p.lat!, lng: p.lng! })),
    [placesForDate],
  );

  if (!mapsLib) return <div className="w-full h-full bg-gray-100 dark:bg-[#2c2c2e] animate-pulse rounded-2xl" />;

  const activeColor = selectedDate ? dateColorMap[selectedDate] : DAY_COLORS[0];

  return (
    <Map
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={12}
      disableDefaultUI={false}
      gestureHandling="greedy"
      className="w-full h-full rounded-2xl"
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
    >
      <MapCenterSetter places={plan.dayPlans} />
      <PolylinePath path={polylinePath} color={activeColor} />

      {placesForDate.map((place, idx) => {
        const color = dateColorMap[place.planDate];
        return (
          <AdvancedMarker
            key={place.dayPlanNum}
            position={{ lat: place.lat!, lng: place.lng! }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white cursor-pointer hover:scale-110 transition-transform"
              style={{ background: color }}
            >
              {idx + 1}
            </div>
          </AdvancedMarker>
        );
      })}

    </Map>
  );
}

export default function PlanViewReadonlyClient({ planNum }: { planNum: number }) {
  const router = useRouter();
  const { show } = useSnackbar();
  const { userNum } = useAuthStore();

  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [focusedDayPlanNum, setFocusedDayPlanNum] = useState<number | null>(null);
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await nestApi.get<PublicPlan>(`/plan/public/${planNum}`);
        setPlan(res.data);
        const dates = uniqueDates(res.data.dayPlans);
        if (dates.length > 0) setSelectedDate(dates[0]);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          const status = (err as { response: { status: number } }).response.status;
          if (status === 403) { setIsForbidden(true); return; }
        }
        show('일정을 불러오지 못했습니다', 'error');
      } finally {
        setIsLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planNum]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e] flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-white/30 text-sm">불러오는 중...</div>
      </main>
    );
  }

  if (isForbidden) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e] flex flex-col items-center justify-center gap-4 text-gray-400 dark:text-white/30">
        <Lock size={40} strokeWidth={1.5} />
        <p className="text-sm">비공개 일정입니다</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
        >
          돌아가기
        </button>
      </main>
    );
  }

  if (!plan) return null;

  const dates = uniqueDates(plan.dayPlans);
  const placesForDate = selectedDate
    ? plan.dayPlans.filter((d) => d.planDate === selectedDate)
    : plan.dayPlans;

  const isOwner = userNum !== null && plan.user.userNum === userNum;

  const handleClone = async () => {
    if (!userNum) { show('로그인이 필요합니다', 'warning'); return; }
    setIsCloning(true);
    try {
      const res = await nestApi.post<{ planNum: number }>(`/plan/${plan.planNum}/clone`);
      show('내 일정으로 복사했습니다', 'success');
      router.push(`/mypage/${res.data.planNum}`);
    } catch {
      show('일정 가져오기에 실패했습니다', 'error');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e]">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">

          {/* 헤더 */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white dark:hover:bg-white/8 border border-gray-200 dark:border-white/8 transition-all cursor-pointer"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white/90">{plan.planName}</h1>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-white/30">
                  <span className="flex items-center gap-1">
                    <User size={11} />
                    {plan.user.name}
                  </span>
                  {plan.city && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {plan.city.cityName}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CalendarDays size={11} />
                    {formatPeriod(plan.startDate, plan.endDate)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* URL 복사 공유 버튼 */}
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(window.location.href).then(() => {
                    show('링크가 복사됐습니다', 'success');
                  });
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#2563EB] hover:bg-[#EFF6FF] dark:hover:bg-white/8 border border-gray-200 dark:border-white/8 transition-all cursor-pointer"
                title="링크 복사"
              >
                <Share2 size={15} />
              </button>

              {/* 본인 일정이면 편집, 타인 일정이면 가져가기 */}
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => router.push(`/plan?edit=${plan.planNum}`)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-all cursor-pointer"
                >
                  편집
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleClone()}
                  disabled={isCloning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Copy size={14} />
                  {isCloning ? '복사 중...' : '가져가기'}
                </button>
              )}
            </div>
          </div>

          {/* 지도 + 일정 리스트 */}
          <div className="grid lg:grid-cols-5 gap-5 items-start">

            {/* 지도 */}
            <div className="lg:col-span-3 h-[480px] rounded-2xl overflow-hidden border border-gray-200 dark:border-white/8 shadow-sm">
              <PlanViewMap
                  plan={plan}
                  selectedDate={selectedDate}
                  focusedDayPlanNum={focusedDayPlanNum}
                />
            </div>

            {/* 일정 리스트 */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              {/* 날짜 탭 */}
              {dates.length > 1 && (
                <div className="flex gap-1.5 flex-wrap">
                  {dates.map((date, i) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border
                        ${selectedDate === date
                          ? 'text-white border-transparent shadow-sm'
                          : 'bg-white dark:bg-[#2c2c2e] text-gray-500 dark:text-white/40 border-gray-200 dark:border-white/8 hover:border-gray-300'
                        }`}
                      style={selectedDate === date ? { background: DAY_COLORS[i % DAY_COLORS.length] } : {}}
                    >
                      {i + 1}일차 <span className="font-normal opacity-70">{date}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 장소 목록 */}
              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                {placesForDate.length === 0 && (
                  <div className="py-12 flex flex-col items-center gap-2 text-gray-300 dark:text-white/20">
                    <MapPin size={28} strokeWidth={1.5} />
                    <span className="text-xs">등록된 장소가 없습니다</span>
                  </div>
                )}
                {placesForDate.map((place, idx) => {
                  const dateIdx = dates.indexOf(place.planDate);
                  const color = DAY_COLORS[dateIdx % DAY_COLORS.length];
                  return (
                    <div
                      key={place.dayPlanNum}
                      onClick={() => place.lat && place.lng && setFocusedDayPlanNum(place.dayPlanNum)}
                      className={`flex gap-3 bg-white dark:bg-[#2c2c2e] rounded-2xl p-3.5 border shadow-sm transition-all
                        ${place.lat && place.lng ? 'cursor-pointer hover:shadow-md' : ''}
                      `}
                      style={{
                        borderColor: focusedDayPlanNum === place.dayPlanNum ? color : undefined,
                        borderWidth: focusedDayPlanNum === place.dayPlanNum ? 2 : 1,
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                        style={{ background: color }}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white/85 line-clamp-1">
                          {place.locationName ?? '장소'}
                        </p>
                        {place.address && (
                          <p className="text-xs text-gray-400 dark:text-white/30 line-clamp-1 mt-0.5">
                            {place.address}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </APIProvider>
    </main>
  );
}
