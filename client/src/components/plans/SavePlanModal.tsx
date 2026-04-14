'use client';
import { useState, useEffect } from 'react';
import { X, Save, Globe, Lock, MapPin } from 'lucide-react';
import Button from '@/components/common/Button';
import { nestApi } from '@/config/api.config';
import usePlanStore, { DayPlan } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';

interface CityOption {
  cityNum: number;
  cityName: string;
  country: string;
}

interface SavePlanModalProps {
  onClose: () => void;
  onSaved: () => void;
}

// Zustand DayPlan 배열을 서버 SavePlanDto.dayPlans 형태로 변환
function buildDayPlanItems(dayPlans: DayPlan[]) {
  return dayPlans.flatMap((day) =>
    day.places.map((place, index) => ({
      planDate: day.date,
      sortOrder: index,
      placeId: place.place_id,
      // DB varchar(50) 제한 — 초과 시 잘라냄
      locationName: place.name.slice(0, 50),
      // DB varchar(100) 제한
      address: place.formatted_address?.slice(0, 100) ?? null,
      lat: place.location.lat,
      lng: place.location.lng,
      // DB varchar(20) 제한
      tel: place.phone?.slice(0, 20) ?? null,
    })),
  );
}

const SavePlanModal = ({ onClose, onSaved }: SavePlanModalProps) => {
  const dayPlans       = usePlanStore((s) => s.dayPlans);
  const currentPlanNum = usePlanStore((s) => s.currentPlanNum);
  const currentPlanName = usePlanStore((s) => s.currentPlanName);
  const currentIsPublic = usePlanStore((s) => s.currentIsPublic);
  const { show } = useSnackbar();

  // 수정 모드면 기존 이름·공개 여부로 초기화, 신규면 빈 값
  const isEditMode = currentPlanNum !== null;
  const [planName, setPlanName] = useState(currentPlanName ?? '');
  const [isPublic, setIsPublic] = useState(currentIsPublic);
  const [cityNum, setCityNum] = useState<number | null>(null);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 도시 목록 로드
  useEffect(() => {
    nestApi.get<CityOption[]>('/city').then((res) => setCities(res.data)).catch(() => {});
  }, []);

  const sortedDates = dayPlans.map((d) => d.date).sort();
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];

  const handleSave = async () => {
    if (!planName.trim()) {
      show('일정 이름을 입력해주세요', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        planName: planName.trim(),
        startDate,
        endDate,
        isPublic,
        ...(cityNum !== null && { cityNum }),
        dayPlans: buildDayPlanItems(dayPlans),
      };

      if (isEditMode) {
        // PUT — 기존 일정 전체 교체 (멱등)
        await nestApi.put(`/plan/${currentPlanNum}/full`, body);
        show('일정이 수정되었습니다!', 'success');
      } else {
        // POST — 신규 저장
        await nestApi.post('/plan/full', body);
        show('일정이 저장되었습니다!', 'success');
      }
      onSaved();
    } catch {
      show(`${isEditMode ? '수정' : '저장'}에 실패했습니다. 다시 시도해주세요.`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPlaces = dayPlans.reduce((acc, d) => acc + d.places.length, 0);

  return (
    // 배경 딤
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white/90">
            {isEditMode ? '일정 수정' : '일정 저장'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 요약 */}
        <div className="text-xs text-gray-400 dark:text-white/30">
          {dayPlans.length}일 · 장소 {totalPlaces}개
          {startDate && (
            <span className="ml-1">· {startDate} ~ {endDate}</span>
          )}
        </div>

        {/* 이름 입력 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 dark:text-white/50">
            일정 이름
          </label>
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="예: 도쿄 3박 4일 여행"
            maxLength={45}
            autoFocus
            className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
          />
        </div>

        {/* 도시 선택 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 dark:text-white/50 flex items-center gap-1">
            <MapPin size={11} />
            도시 <span className="font-normal text-gray-400 dark:text-white/25">(선택)</span>
          </label>
          <select
            value={cityNum ?? ''}
            onChange={(e) => setCityNum(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white cursor-pointer"
          >
            <option value="">선택 안 함</option>
            {cities.map((city) => (
              <option key={city.cityNum} value={city.cityNum}>
                {city.cityName} · {city.country}
              </option>
            ))}
          </select>
        </div>

        {/* 공개 여부 토글 */}
        <button
          onClick={() => setIsPublic((v) => !v)}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-sm
            ${isPublic
              ? 'border-indigo-300 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
              : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-500 dark:text-white/40'
            }`}
        >
          {isPublic ? <Globe size={15} /> : <Lock size={15} />}
          <span className="font-medium">{isPublic ? '공개' : '비공개'}</span>
          <span className="ml-auto text-xs opacity-60">
            {isPublic ? '커뮤니티에 공유됩니다' : '나만 볼 수 있습니다'}
          </span>
        </button>

        {/* 버튼 */}
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isSaving ? (isEditMode ? '수정 중...' : '저장 중...') : (isEditMode ? '수정 완료' : '저장')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SavePlanModal;
