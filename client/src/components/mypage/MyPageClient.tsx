'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Calendar,
  Globe,
  Lock,
  Trash2,
  UserCircle,
  PlaneTakeoff,
  Eye,
  Pencil,
  Link,
  Unlink,
} from 'lucide-react';
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

interface SocialLinkInfo {
  provider: 'google' | 'kakao' | 'naver';
  createdAt: string;
}

const SOCIAL_PROVIDERS = [
  {
    key: 'google' as const,
    label: '구글',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
  {
    key: 'kakao' as const,
    label: '카카오',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path fill="#3C1E1E" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.58 5.07 4 6.51L5.2 21l4.04-2.66c.9.17 1.82.26 2.76.26 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
      </svg>
    ),
  },
  {
    key: 'naver' as const,
    label: '네이버',
    icon: (
      <div className="w-5 h-5 bg-[#03C75A] rounded flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
          <path fill="#fff" d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
        </svg>
      </div>
    ),
  },
];

// 스켈레톤 — 일정 카드
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

// 스켈레톤 — hydration 전 전체 페이지 레이아웃 유지용
const SkeletonPage = () => (
  <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e]">
    <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">
      {/* 프로필 */}
      <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-6 border border-gray-100 dark:border-white/8 shadow-sm flex items-center gap-4">
        <div className="skeleton w-16 h-16 rounded-2xl flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="skeleton h-5 rounded-full w-1/3" />
          <div className="skeleton h-3.5 rounded-full w-1/2" />
        </div>
      </div>
      {/* 소셜 연동 */}
      <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-6 border border-gray-100 dark:border-white/8 shadow-sm flex flex-col gap-4">
        <div className="skeleton h-4 rounded-full w-1/4" />
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="skeleton w-5 h-5 rounded-full" />
                <div className="skeleton h-4 rounded-full w-16" />
              </div>
              <div className="skeleton w-14 h-7 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
      {/* 일정 목록 */}
      <div className="flex flex-col gap-4">
        <div className="skeleton h-5 rounded-full w-1/4" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  </main>
);

const NEST_URL = process.env.NEXT_PUBLIC_NEST_URL ?? 'http://localhost:3001';

const MyPageClient = () => {
  const router = useRouter();
  const { show } = useSnackbar();
  const { token, userName, userEmail, _hasHydrated } = useAuthStore();

  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 삭제 확인 중인 planNum — 같은 버튼을 다시 클릭하면 확정 삭제
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [socialLinks, setSocialLinks] = useState<SocialLinkInfo[]>([]);
  // 연동 시작 중인 provider — 버튼 로딩 표시용
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  // hydration 완료 후에만 검사 — 복원 전 token=null을 미로그인으로 오판하면 새로고침 시 login으로 튕김
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!token) {
      router.replace('/login');
    }
  }, [_hasHydrated, token, router]);

  useEffect(() => {
    if (!token) return;
    nestApi
      .get<PlanSummary[]>('/plan')
      .then((res) => setPlans(res.data))
      .catch(() => show('일정을 불러오지 못했습니다', 'error'))
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    nestApi
      .get<SocialLinkInfo[]>('/auth/me/social-links')
      .then((res) => setSocialLinks(res.data))
      .catch(() => {});
  }, [token]);

  // OAuth 리다이렉트 후 쿼리 파라미터로 결과 수신
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get('linked');
    const error = params.get('error');

    if (linked) {
      const label = SOCIAL_PROVIDERS.find((p) => p.key === linked)?.label ?? linked;
      show(`${label} 계정이 연동되었습니다`, 'success');
      window.history.replaceState({}, '', '/mypage');
      // 연동 목록 갱신
      nestApi.get<SocialLinkInfo[]>('/auth/me/social-links').then((res) => setSocialLinks(res.data)).catch(() => {});
    }
    if (error === 'link_failed') {
      show('소셜 연동에 실패했습니다', 'error');
      window.history.replaceState({}, '', '/mypage');
    }
    if (error === 'already_linked') {
      show('이미 다른 계정에 연동된 소셜 계정입니다', 'error');
      window.history.replaceState({}, '', '/mypage');
    }
    if (error === 'invalid_link') {
      show('연동 요청이 만료되었습니다. 다시 시도해 주세요', 'error');
      window.history.replaceState({}, '', '/mypage');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLinkSocial = async (provider: string) => {
    setLinkingProvider(provider);
    try {
      const res = await nestApi.post<{ code: string }>(`/auth/link-init/${provider}`);
      window.location.href = `${NEST_URL}/api/auth/${provider}/link?lk=${res.data.code}`;
    } catch {
      show('연동을 시작할 수 없습니다', 'error');
      setLinkingProvider(null);
    }
  };

  const handleUnlinkSocial = async (provider: string) => {
    try {
      await nestApi.delete(`/auth/social-links/${provider}`);
      setSocialLinks((prev) => prev.filter((l) => l.provider !== provider));
      const label = SOCIAL_PROVIDERS.find((p) => p.key === provider)?.label ?? provider;
      show(`${label} 연동이 해제되었습니다`, 'info');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : '연동 해제에 실패했습니다';
      show(msg, 'error');
    }
  };

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

  // hydration 전엔 레이아웃이 붕괴되지 않도록 스켈레톤 유지
  if (!_hasHydrated) return <SkeletonPage />;
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

        {/* 소셜 계정 연동 */}
        <section className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-6 border border-gray-100 dark:border-white/8 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Link size={16} className="text-gray-400 dark:text-white/30" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white/90">소셜 계정 연동</h2>
          </div>
          <div className="flex flex-col gap-3">
            {SOCIAL_PROVIDERS.map(({ key, label, icon }) => {
              const linked = socialLinks.find((l) => l.provider === key);
              const isLinking = linkingProvider === key;

              return (
                <div
                  key={key}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-3">
                    {icon}
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-white/70">
                        {label}
                      </span>
                      {linked && (
                        <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">
                          {new Date(linked.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 연동
                        </p>
                      )}
                    </div>
                    {linked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 font-bold">
                        연동됨
                      </span>
                    )}
                  </div>
                  {linked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleUnlinkSocial(key)}
                      className="flex items-center gap-1 text-gray-400 hover:text-red-500"
                    >
                      <Unlink size={12} />
                      해제
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleLinkSocial(key)}
                      disabled={isLinking}
                      className="flex items-center gap-1"
                    >
                      {isLinking ? (
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                      ) : (
                        <Link size={12} />
                      )}
                      {isLinking ? '연결 중' : '연동'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

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
