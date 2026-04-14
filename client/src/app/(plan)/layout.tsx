'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/common/Header';
import usePlanStore from '@/store/usePlanStore';

// 일정 편집 중 이탈 확인 모달
const ExitConfirmModal = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center">
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    />
    <div className="relative z-10 bg-white dark:bg-[#2c2c2e] rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-white/8 max-w-sm w-full mx-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
        저장하지 않고 나가시겠습니까?
      </h2>
      <p className="text-sm text-gray-400 dark:text-white/40 mb-6">
        지금까지 추가한 장소가 모두 초기화됩니다.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          계속 편집
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-all cursor-pointer"
        >
          나가기
        </button>
      </div>
    </div>
  </div>
);

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const showExitGuard = usePlanStore((s) => s.showExitGuard);
  const setShowExitGuard = usePlanStore((s) => s.setShowExitGuard);
  const fullReset = usePlanStore((s) => s.fullReset);

  // ref로 최신 dayPlans 값 참조 — popstate 핸들러 클로저 재생성 없이 최신 상태 조회
  // 날짜만 설정된 경우도 포함 — 플랜 페이지를 떠날 때 항상 초기화 확인
  const hasPlanDataRef = useRef(false);
  hasPlanDataRef.current = dayPlans.length > 0;

  // 브라우저 뒤로가기 인터셉트
  // 더미 history 엔트리를 추가해두고 popstate 발생 시 장소가 있으면 모달 표시
  useEffect(() => {
    window.history.pushState({ planGuard: true }, '');

    const handlePopState = () => {
      if (hasPlanDataRef.current) {
        // 더미 엔트리 재추가 — 실제 뒤로가기 방지
        window.history.pushState({ planGuard: true }, '');
        setShowExitGuard(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirmExit = () => {
    fullReset();
    router.push('/');
  };

  const handleCancelExit = () => {
    setShowExitGuard(false);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      {showExitGuard && (
        <ExitConfirmModal onConfirm={handleConfirmExit} onCancel={handleCancelExit} />
      )}
    </div>
  );
}
