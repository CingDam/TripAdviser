'use client';
import { useEffect } from 'react';
import { nestApi } from '@/config/api.config';
import usePlanStore, { SavedDayPlanItem } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import { useRouter } from 'next/navigation';

interface PlanDetailResponse {
  planNum: number;
  planName: string;
  isPublic: number;
  startDate: string | null;
  endDate: string | null;
  city: { cityNum: number; lat: number; lng: number } | null;
  dayPlans: SavedDayPlanItem[];
}

// 수정 모드 진입 시 plan 페이지에 마운트되어 기존 일정 데이터를 스토어에 로드.
// UI를 렌더하지 않고 fetch + store 적재만 담당한다.
const PlanEditLoader = ({ planNum }: { planNum: number }) => {
  const loadPlanData = usePlanStore((s) => s.loadPlanData);
  const { show } = useSnackbar();
  const router = useRouter();

  useEffect(() => {
    nestApi
      .get<PlanDetailResponse>(`/plan/${planNum}`)
      .then((res) => {
        const { planName, isPublic, dayPlans, city } = res.data;
        loadPlanData(planNum, planName, isPublic === 1, dayPlans, city?.cityNum);
      })
      .catch(() => {
        show('일정을 불러오지 못했습니다', 'error');
        router.replace('/mypage');
      });
  // planNum은 URL에서 온 정적 값 — 마운트 시 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default PlanEditLoader;
