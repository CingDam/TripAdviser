'use client';
import { MapPin, Calendar, Globe, Lock, Trash2, Eye, Pencil } from 'lucide-react';
import Button from '@/components/common/Button';
import { PlanSummary } from '@/types/plan';

interface PlanCardProps {
  plan: PlanSummary;
  isConfirming: boolean;
  isDeleting: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const placeCount = (plan: PlanSummary) =>
  plan.dayPlans.filter((dp) => dp.placeId !== null).length;

const formatDateRange = (start: string | null, end: string | null) => {
  if (!start) return '날짜 미설정';
  if (!end || start === end) return start;
  return `${start} ~ ${end}`;
};

export default function PlanCard({ plan, isConfirming, isDeleting, onView, onEdit, onDelete }: PlanCardProps) {
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 border border-gray-100 dark:border-white/8 shadow-sm flex flex-col gap-3 transition-all hover:shadow-md dark:hover:border-white/12">
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
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400'
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
          <Button variant="secondary" size="sm" onClick={onView} className="flex items-center gap-1">
            <Eye size={12} />
            보기
          </Button>
          {/* 수정 — plan 에디터로 이동, 도시 좌표가 있으면 lat/lng도 전달해 지도 중심 설정 */}
          <Button variant="secondary" size="sm" onClick={onEdit} className="flex items-center gap-1">
            <Pencil size={12} />
            수정
          </Button>
          {/* 삭제 — 첫 클릭 확인, 재클릭 확정 */}
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
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
}
