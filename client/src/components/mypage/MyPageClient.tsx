'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';
import {
  UserCircle,
  PlaneTakeoff,
  Pencil,
  Check,
  X,
  Camera,
  Shuffle,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import { nestApi } from '@/config/api.config';
import Button from '@/components/common/Button';
import { generateNickname } from '@/utils/nickname';
import { PlanSummary } from '@/types/plan';
import PlanCard from './PlanCard';
import SocialLinkSection, { SocialLinkInfo, getProviderLabel } from './SocialLinkSection';

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
  const { token, userName, userEmail, profileImg, setProfile, _hasHydrated } = useAuthStore();

  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 삭제 확인 중인 planNum — 같은 버튼을 다시 클릭하면 확정 삭제
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [socialLinks, setSocialLinks] = useState<SocialLinkInfo[]>([]);
  // 연동 시작 중인 provider — 버튼 로딩 표시용
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  // 프로필 수정 상태
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const label = getProviderLabel(linked);
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

  const handleEditProfileOpen = () => {
    setEditName(userName ?? '');
    setPreviewImg(null);
    setPendingFile(null);
    setIsEditingProfile(true);
  };

  const handleProfileImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreviewImg(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { show('이름을 입력해 주세요', 'warning'); return; }
    setIsSavingProfile(true);
    try {
      const formData = new FormData();
      formData.append('name', editName.trim());
      if (pendingFile) formData.append('profileImg', pendingFile);

      const res = await nestApi.patch<{ name: string; profileImg: string | null }>('/user/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile({ userName: res.data.name, profileImg: res.data.profileImg ?? null });
      setIsEditingProfile(false);
      show('프로필이 저장됐습니다', 'success');
    } catch (error: unknown) {
      // 닉네임 중복(409) 등 서버 메시지를 그대로 노출
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? '저장에 실패했습니다')
        : '저장에 실패했습니다';
      show(message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
      show(`${getProviderLabel(provider)} 연동이 해제되었습니다`, 'info');
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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e]">
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">

        {/* 프로필 섹션 */}
        <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-6 border border-gray-100 dark:border-white/8 shadow-sm flex items-center gap-4">
          {/* 아바타 */}
          <div className="relative flex-shrink-0">
            {(previewImg ?? profileImg) ? (
              <Image
                src={previewImg ?? profileImg!}
                alt="프로필"
                width={64}
                height={64}
                className="w-16 h-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center shadow-md shadow-blue-500/20">
                <UserCircle size={32} className="text-white" strokeWidth={1.5} />
              </div>
            )}
            {isEditingProfile && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center cursor-pointer"
                >
                  <Camera size={18} className="text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfileImgChange}
                />
              </>
            )}
          </div>

          {/* 이름 / 이메일 */}
          <div className="flex-1 min-w-0">
            {isEditingProfile ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={15}
                  className="flex-1 min-w-0 text-lg font-bold bg-transparent border-b-2 border-[#2563EB] outline-none text-gray-900 dark:text-white/90 pb-0.5"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setEditName(generateNickname())}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-[#2563EB] dark:text-white/30 dark:hover:text-[#60A5FA] transition-colors cursor-pointer"
                  title="닉네임 자동 생성"
                >
                  <Shuffle size={12} />
                  생성
                </button>
              </div>
            ) : (
              <h1 className="text-lg font-bold text-gray-900 dark:text-white/90 truncate">
                {userName ?? '사용자'}
              </h1>
            )}
            <p className="text-sm text-gray-400 dark:text-white/35 mt-0.5 truncate">{userEmail}</p>
          </div>

          {/* 편집 / 저장 버튼 */}
          {isEditingProfile ? (
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={isSavingProfile}
                className="w-8 h-8 rounded-xl bg-[#2563EB] flex items-center justify-center text-white hover:bg-[#1D4ED8] transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingProfile
                  ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Check size={14} />}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="w-8 h-8 rounded-xl border border-gray-200 dark:border-white/8 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white/70 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleEditProfileOpen}
              className="w-8 h-8 rounded-xl border border-gray-200 dark:border-white/8 flex items-center justify-center text-gray-400 hover:text-[#2563EB] hover:border-[#DBEAFE] dark:hover:border-white/20 transition-all cursor-pointer flex-shrink-0"
              title="프로필 수정"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>

        {/* 소셜 계정 연동 */}
        <SocialLinkSection
          socialLinks={socialLinks}
          linkingProvider={linkingProvider}
          onLink={(p) => void handleLinkSocial(p)}
          onUnlink={(p) => void handleUnlinkSocial(p)}
        />

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
          {plans.map((plan) => (
            <PlanCard
              key={plan.planNum}
              plan={plan}
              isConfirming={confirmDeleteId === plan.planNum}
              isDeleting={deletingId === plan.planNum}
              onView={() => router.push(`/mypage/${plan.planNum}`)}
              onEdit={() => {
                // 도시 좌표가 있으면 lat/lng도 전달해 에디터 지도 중심 설정
                const cityParams = plan.city ? `&lat=${plan.city.lat}&lng=${plan.city.lng}` : '';
                router.push(`/plan?edit=${plan.planNum}${cityParams}`);
              }}
              onDelete={() => handleDeleteClick(plan.planNum)}
            />
          ))}
        </section>
      </div>
    </main>
  );
};

export default MyPageClient;
