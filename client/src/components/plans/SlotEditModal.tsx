'use client';
import { X, Plane, Hotel, Train } from 'lucide-react';
import usePlanStore, { GooglePlace } from '@/store/usePlanStore';
import Button from '@/components/common/Button';
import PlaceSearch from './PlaceSearch';
import { PlaceSearchResult, TRANSIT_TYPES } from '@/types/place';

interface SlotEditModalProps {
  date: string;
  slotType: NonNullable<GooglePlace['slotType']>;
  onClose: () => void;
}

const SLOT_LABELS: Record<NonNullable<GooglePlace['slotType']>, string> = {
  hotel:          '호텔',
  airport_depart: '출발지',
  airport_arrive: '도착지',
};

const SlotEditModal = ({ date, slotType, onClose }: SlotEditModalProps) => {
  const dayPlans      = usePlanStore((s) => s.dayPlans);
  const reorderDayPlan = usePlanStore((s) => s.reorderDayPlan);

  const currentSlot = dayPlans
    .find((d) => d.date === date)
    ?.places.find((p) => p.slotType === slotType) ?? null;

  const handleSelect = (place: PlaceSearchResult) => {
    const day = dayPlans.find((d) => d.date === date);
    if (!day) return;

    const newPlace: GooglePlace = {
      place_id: place.place_id,
      name: place.name,
      formatted_address: place.formatted_address,
      location: place.location,
      types: place.types,
      slotType,
    };

    // 해당 날짜에서 같은 slotType만 교체
    const updated = day.places.map((p) => p.slotType === slotType ? newPlace : p);
    reorderDayPlan(date, updated);
    onClose();
  };

  const handleRemove = () => {
    const day = dayPlans.find((d) => d.date === date);
    if (!day) return;
    reorderDayPlan(date, day.places.filter((p) => p.slotType !== slotType));
    onClose();
  };

  const isTransitSlot = slotType !== 'hotel';
  const Icon = slotType === 'hotel' ? Hotel : Plane;
  const label = SLOT_LABELS[slotType];

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl w-[320px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <div className="flex items-center gap-2">
            <Icon size={15} className="text-[#2563EB] dark:text-[#60A5FA]" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white/90">{label} 변경</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-[11px] text-gray-400 dark:text-white/30">{date} · 이 날짜의 {label}만 변경됩니다.</p>

          {/* 현재 선택 */}
          {currentSlot && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFF6FF] dark:bg-[#2563EB]/10 border border-[#DBEAFE] dark:border-[#3B82F6]/30">
              {currentSlot.types?.some((t) => TRANSIT_TYPES.includes(t))
                ? <Train size={13} className="text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0" />
                : <Icon size={13} className="text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">{currentSlot.name}</p>
                <p className="text-[10px] text-gray-400 dark:text-white/30 truncate">{currentSlot.formatted_address}</p>
              </div>
            </div>
          )}

          {/* 검색 — 호텔은 토글 없음, 출발지/도착지는 공항/역·터미널 토글 */}
          <PlaceSearch
            mode={isTransitSlot ? 'transit' : 'hotel'}
            onSelect={handleSelect}
            resultMaxHeight="max-h-44"
          />
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 dark:border-white/8">
          <Button variant="danger" onClick={handleRemove} className="flex-1">
            슬롯 제거
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">
            취소
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SlotEditModal;
