import { Plane, Hotel, Train, Lock } from 'lucide-react';
import { GooglePlace } from '@/store/usePlanStore';
import { TRANSIT_TYPES } from '@/types/place';

const SLOT_LABELS: Record<NonNullable<GooglePlace['slotType']>, string> = {
  hotel:          '호텔',
  airport_depart: '출발지',
  airport_arrive: '도착지',
};

const SLOT_ICONS: Record<NonNullable<GooglePlace['slotType']>, typeof Plane> = {
  hotel:          Hotel,
  airport_depart: Plane,
  airport_arrive: Plane,
};

// 중간 날짜 호텔 위치(before/after)에 따라 라벨 결정
function getHotelLabel(dayIndex: number, totalDays: number, isBeforeSlot: boolean): string {
  if (totalDays === 1) return '호텔';
  if (dayIndex === 0) return '체크인';
  if (dayIndex === totalDays - 1) return '체크아웃';
  return isBeforeSlot ? '숙박 중 (전날)' : '숙박 중';
}

// 고정 슬롯 카드 — 호텔·공항 자동배치 장소, 드래그 불가 + 변경 버튼
const SlotItem = ({
  place, isLast, color, date, dayIndex, totalDays, isBeforeSlot, onEditSlot,
}: {
  place: GooglePlace;
  isLast: boolean;
  color: string;
  date: string;
  dayIndex: number;
  totalDays: number;
  isBeforeSlot: boolean;
  onEditSlot: (date: string, slotType: NonNullable<GooglePlace['slotType']>) => void;
}) => {
  // 역·터미널로 설정된 슬롯은 Train 아이콘으로 표시
  const isTransit = place.slotType !== 'hotel' && place.types?.some((t) => TRANSIT_TYPES.includes(t));
  const Icon = isTransit ? Train : SLOT_ICONS[place.slotType!];
  const label = place.slotType === 'hotel'
    ? getHotelLabel(dayIndex, totalDays, isBeforeSlot)
    : SLOT_LABELS[place.slotType!];
  return (
    <div className={`flex gap-3 ${isLast ? 'pb-2' : 'pb-3'}`}>
      {/* 왼쪽: 아이콘 원 + 연결선 */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: color + '22', border: `1.5px dashed ${color}` }}
        >
          <Icon size={13} style={{ color }} />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-6 my-1" style={{ background: color + '33' }} />
        )}
      </div>

      {/* 오른쪽: 슬롯 정보 */}
      <div className="flex-1 min-w-0 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: color + '18', color }}
            >
              {label}
            </span>
            {/* 고정 슬롯임을 명시 — 드래그 불가 상태 시각 단서 */}
            <Lock size={9} className="text-gray-300 dark:text-white/20" />
          </div>
          <p className="text-xs font-semibold text-gray-800 dark:text-white/80 mt-0.5 truncate">{place.name}</p>
          <p className="text-[11px] text-gray-400 dark:text-white/30 truncate">{place.formatted_address}</p>
        </div>
        <button
          onClick={() => onEditSlot(date, place.slotType!)}
          className="flex-shrink-0 mt-0.5 text-[11px] px-2.5 py-1 rounded-lg border border-[#DBEAFE] dark:border-[#3B82F6]/30 text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#2563EB]/10 transition-colors cursor-pointer font-medium"
        >
          변경
        </button>
      </div>
    </div>
  );
};

export default SlotItem;
