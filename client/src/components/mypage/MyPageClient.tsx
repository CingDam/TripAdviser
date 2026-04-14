'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Globe, Lock, Trash2, UserCircle, PlaneTakeoff, Eye, Pencil } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import { nestApi } from '@/config/api.config';
import Button from '@/components/common/Button';

interface PlanSummary {
  planNum: number;
  planName: string;
  startDate: string | null;
  endDate: string | null;
  isPublic: number;
  // lat/lng — 수정 진입 시 해당 도시로 지도 초기 중심 설정
  city: { cityName: string; country: string; lat: number; lng: number } | null;
  // 장소 수 계산용 — placeId가 null이 아닌 항목만 카운트
  dayPlans: { placeId: string | null }[];
  createdAt: string;
}

// 스켈레톤 카드
const SkeletonCard = () => (
  <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 border border-gray-100 dark:border-white/8">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 flex flex-col gap-2.5">
        <div className="skeleton h-5 rounded-full w-1/2" />
        <div className="skeleton h-3.5 rounded-full w-1/3" />
        <div className="skeleton h-3.5 rounded-full w-1/4" />
      </div>
      <div className="skeleton w-16 h-8 rounded-xl" />
    </div>
  </div>
);

const MyPageClient = () => {
  const router = useRouter();
  const { show } = useSnackbar();
  const { token, userName, userEmail } = useAuthStore();

  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 삭제 확인 중인 planNum — 같은 버튼을 다시 클릭하면 확정 삭제
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 미로그인 시 로그인 페이지로 이동
  useEffect(() => {
    if (!token) {
      router.replace('/login');
    }
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    nestApi
      .get<PlanSummary[]>('/plan')
      .then((res) => setPlans(res.data))
      .catch(() => show('일정을 불러오지 못했습니다', 'error'))
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDeleteClick = (planNum: number) => {
    if (confirmDeleteId !== planNum) {
      // 첫 클릭 — 확인 상태로 전환 (3초 후 자동 해제)
      setConfirmDeleteId(planNum);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === planNum ? null : cur)), 3000);
      return;
    }
    // 두 번째 클릭 — 실제 삭제
    void handleDeleteConfirm(planNum);
  };

  const handleDeleteConfirm = async (planNum: number) => {
    setDeletingId(planNum);
    setConfirmDeleteId(null);
    try {
      await nestApi.delete(`/plan/${planNum}`);
      setPlans((prev) => prev.filter((p) => p.planNum !== planNum));
      show('일정이 삭제되었습니다', 'info');
    } catch {
      show('삭제에 실패했습니다', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (!token) return null;

  const placeCount = (plan: PlanSummary) =>
    plan.dayPlans.filter((dp) => dp.placeId !== null).length;

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start) return '날짜 미설정';
    if (!end || start === end) return start;
    return `${start} ~ ${end}`;
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e]">
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">

        {/* 프로필 섹션 */}
        <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-6 border border-gray-100 dark:border-white/8 shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
            <UserCircle size={32} className="text-white" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white/90 truncate">
              {userName ?? '사용자'}
            </h1>
            <p className="text-sm text-gray-400 dark:text-white/35 mt-0.5 truncate">{userEmail}</p>
          </div>
        </div>

        {/* 일정 목록 */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 dark:text-white/90">
              내 일정
              {!isLoading && (
                <span className="ml-2 text-sm font-normal text-gray-400 dark:text-white/30">
                  {plans.length}개
                </span>
              )}
            </h2>
            <Button variant="primary" size="sm" onClick={() => router.push('/plan')}>
              새 일정
            </Button>
          </div>

          {/* 로딩 */}
          {isLoading && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {/* 빈 상태 */}
          {!isLoading && plans.length === 0 && (
            <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-gray-100 dark:border-white/8 p-12 flex flex-col items-center gap-3 text-gray-300 dark:text-white/20">
              <PlaneTakeoff size={40} strokeWidth={1.5} />
              <span className="text-sm">아직 저장된 일정이 없습니다</span>
            </div>
          )}

          {/* 일정 카드 목록 */}
          {plans.map((plan) => {
            const isConfirming = confirmDeleteId === plan.planNum;
            const isDeleting = deletingId === plan.planNum;

            return (
              <div
                key={plan.planNum}
                className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 border border-gray-100 dark:border-white/8 shadow-sm flex flex-col gap-3 transition-all hover:shadow-md dark:hover:border-white/12"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white/90 truncate">
                        {plan.planName}
                      </h3>
                      {/* 공개/비공개 뱃지 */}
                      <span
                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0
                          ${plan.isPublic
                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400'
                            : 'bg-gray-100 dark:bg-white/8 text-gray-400 dark:text-white/30'
                          }`}
                      >
                        {plan.isPublic ? <Globe size={9} /> : <Lock size={9} />}
                        {plan.isPublic ? '공개' : '비공개'}
                      </span>
                    </div>

                    {/* 메타 정보 */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/35">
                        <Calendar size={11} />
                        {formatDateRange(plan.startDate, plan.endDate)}
                      </span>
                      {plan.city && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/35">
                          <MapPin size={11} />
                          {plan.city.cityName}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 dark:text-white/35">
                        장소 {placeCount(plan)}개
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    {/* 보기 */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(`/mypage/${plan.planNum}`)}
                      className="flex items-center gap-1"
                    >
                      <Eye size={12} />
                      보기
                    </Button>
                    {/* 수정 — plan 에디터로 이동, 도시 좌표가 있으면 lat/lng도 전달해 지도 중심 설정 */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const base = `/plan?edit=${plan.planNum}`;
                        const cityParams = plan.city
                          ? `&lat=${plan.city.lat}&lng=${plan.city.lng}`
                          : '';
                        router.push(base + cityParams);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Pencil size={12} />
                      수정
                    </Button>
                    {/* 삭제 — 첫 클릭 확인, 재클릭 확정 */}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteClick(plan.planNum)}
                      disabled={isDeleting}
                      className={`flex items-center gap-1 transition-all ${
                        isConfirming
                          ? 'border-red-400 dark:border-red-500/60 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
                          : ''
                      }`}
                    >
                      {isDeleting ? (
                        <div className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      {isConfirming ? '확인' : '삭제'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
};

export default MyPageClient;
