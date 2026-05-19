"use client"
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { GripVertical, MapPin, Star, ClipboardList, Sparkles, ChevronLeft, ChevronRight, Plane, Hotel, Settings2, Lock } from 'lucide-react'
import usePlanStore, { GooglePlace } from '@/store/usePlanStore'
import { nestApi } from '@/config/api.config'
import PlaceDetailContainer from './PlaceDetailContainer'
import SavePlanModal from './SavePlanModal'
import TripSetupModal from './TripSetupModal'
import SlotEditModal from './SlotEditModal'
import { getTag, getPriceLabel } from '@/utils/placeUtils'
import { DAY_COLORS, getDayColor } from '@/constants/dayColors'
import Button from '@/components/common/Button'
import { useSnackbar } from '@/components/common/SnackbarProvider'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// AI 자동생성 카테고리 표시 순서 및 라벨
const CATEGORY_ORDER = ['관광지', '자연', '문화', '식당', '카페', '쇼핑'];
const CATEGORY_EMOJI: Record<string, string> = {
  관광지: '🗺️', 자연: '🌿', 문화: '🏛️', 식당: '🍽️', 카페: '☕', 쇼핑: '🛍️',
};

const SLOT_LABELS: Record<NonNullable<GooglePlace['slotType']>, string> = {
  hotel:          '호텔',
  airport_depart: '출발 공항',
  airport_arrive: '도착 공항',
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
  const Icon = SLOT_ICONS[place.slotType!];
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

// 타임라인 장소 카드 — 번호 원 + 세로 연결선 + 썸네일 + 정보
const PlaceItem = ({
  place, index, isLast, color, onRemove, setDetailPlace, dragHandleProps, isNew,
}: {
  place: GooglePlace;
  index: number;
  isLast: boolean;
  color: string;
  onRemove: () => void;
  setDetailPlace: (p: GooglePlace) => void;
  // dragHandleProps: useSortable listeners — 드래그 핸들에 spread해서 드래그 이벤트 바인딩
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  isNew?: boolean;
}) => {
  const tag = getTag(place.types ?? []);
  return (
    <div className={`flex gap-3 ${isNew ? 'animate-place-card-in' : ''}`}>
      {/* 왼쪽: 드래그 핸들 + 번호 원 + 연결선 */}
      <div className="flex flex-col items-center flex-shrink-0">
        {/* 드래그 핸들 */}
        <div
          {...dragHandleProps}
          className="text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/50 cursor-grab active:cursor-grabbing mb-1 select-none flex items-center"
        >
          <GripVertical size={14} />
        </div>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
          style={{ background: color }}
        >
          {index + 1}
        </div>
        {/* 마지막 항목이 아니면 점선 연결 */}
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-6 my-1" style={{ background: color + '44' }} />
        )}
      </div>

      {/* 오른쪽: 카드 */}
      <div className={`flex-1 min-w-0 ${isLast ? 'pb-2' : 'pb-4'}`}>
        <div
          className="flex gap-2.5 items-start cursor-pointer group"
          onClick={() => setDetailPlace(place)}
        >
          {/* 썸네일 — 카테고리별 Lucide 아이콘 + 색상 배경 */}
          {(() => {
            const thumbTag = getTag(place.types ?? []);
            const ThumbIcon = thumbTag?.Icon ?? MapPin;
            return (
              <div
                className="flex-shrink-0 rounded-xl flex items-center justify-center"
                style={{
                  width: 52,
                  height: 52,
                  background: thumbTag ? thumbTag.color + '18' : '#EFF6FF',
                }}
              >
                <ThumbIcon size={22} strokeWidth={1.8} style={{ color: thumbTag ? thumbTag.color : '#93C5FD' }} />
              </div>
            );
          })()}
          {/* 텍스트 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <strong className="text-sm font-semibold truncate max-w-[100px] text-gray-900 dark:text-white/90 group-hover:text-gray-500 dark:group-hover:text-[#60A5FA] transition-colors">
                {place.name}
              </strong>
              {place.rating && (
                <span className="flex items-center gap-0.5 text-xs text-amber-400 font-medium">
                  <Star size={10} fill="currentColor" strokeWidth={0} />
                  {place.rating}
                </span>
              )}
              {tag && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: tag.color + '22', color: tag.color }}
                >
                  {tag.label}
                </span>
              )}
              {place.timeSlot && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#DBEAFE] text-[#2563EB] dark:bg-[#3B82F6]/20 dark:text-[#60A5FA]">
                  {place.timeSlot}
                </span>
              )}
              {(() => {
                const price = getPriceLabel(place.priceLevel);
                return price ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-white/40">
                    {price}
                  </span>
                ) : null;
              })()}
            </div>
            <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 truncate">{place.formatted_address}</p>
          </div>
        </div>

        {/* 삭제 버튼 */}
        <button
          onClick={onRemove}
          className="mt-1.5 text-[11px] px-2 py-0.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/30 hover:border-red-200 dark:hover:border-red-500/40 hover:text-red-400 transition-colors cursor-pointer"
        >
          삭제
        </button>
      </div>
    </div>
  );
};

// 드래그 가능한 PlaceItem 래퍼 — useSortable 훅으로 DnD 바인딩
const SortablePlaceItem = (props: Omit<Parameters<typeof PlaceItem>[0], 'dragHandleProps'>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.place.place_id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // 드래그 중인 항목은 반투명 처리
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 'auto',
      }}
      {...attributes}
    >
      {/* listeners는 드래그 핸들 요소에만 전달 — 카드 전체가 아닌 핸들만 드래그 가능 */}
      <PlaceItem {...props} dragHandleProps={listeners} />
    </div>
  );
};

interface PlanContainerProps {
  isCollapsed: boolean;
  onCollapse: (v: boolean) => void;
}

const PlanContainer = ({ isCollapsed, onCollapse }: PlanContainerProps) => {
  const dayPlans             = usePlanStore((s) => s.dayPlans);
  const selectedDate         = usePlanStore((s) => s.selectedDate);
  const setSelectedDate      = usePlanStore((s) => s.setSelectedDate);
  const searchParams         = usePlanStore((s) => s.searchParams);
  const removePlaceFromDayPlan = usePlanStore((s) => s.removePlaceFromDayPlan);
  const addPlaceToDayPlan    = usePlanStore((s) => s.addPlaceToDayPlan);
  const clearDayPlans        = usePlanStore((s) => s.clearDayPlans);
  const reorderDayPlan       = usePlanStore((s) => s.reorderDayPlan);
  const fullReset            = usePlanStore((s) => s.fullReset);
  const detailPlace          = usePlanStore((s) => s.detailPlace);
  const setDetailPlace       = usePlanStore((s) => s.setDetailPlace);

  const router = useRouter();
  const { show } = useSnackbar();
  const [isSorting, setIsSorting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showTripSetup, setShowTripSetup] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCityInput, setShowCityInput] = useState(false);
  // 날짜별 도시 입력 — key: date, value: 도시명 (빈 문자열 = 대표 도시 폴백)
  const [dayCities, setDayCities] = useState<Record<string, string>>({});
  // 슬롯 변경: 특정 날짜의 특정 슬롯 타입만 교체하는 모달
  const [slotEdit, setSlotEdit] = useState<{ date: string; slotType: NonNullable<GooglePlace['slotType']> } | null>(null);
  const [newPlaceId, setNewPlaceId] = useState<string | null>(null);
  // 이전 places 길이를 기억해 새로 추가된 항목만 애니메이션 트리거
  const prevPlacesLengthRef = useRef<number>(0);

  // PointerSensor: 마우스/터치 드래그 — activationConstraint로 클릭과 구분 (8px 이동 후 활성화)
  // KeyboardSensor: 키보드 접근성 지원
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const isAllView = selectedDate === 'all';
  const currentPlaces = useMemo(
    () => isAllView
      ? dayPlans.flatMap((d) => d.places)
      : dayPlans.find((d) => d.date === selectedDate)?.places ?? [],
    [isAllView, dayPlans, selectedDate],
  );

  // 슬롯이 아닌 일반 장소만 — AI 정렬·드래그 대상
  const normalPlaces = useMemo(
    () => currentPlaces.filter((p) => !p.slotType),
    [currentPlaces],
  );
  const hasEmptyNormalDay = dayPlans.some((d) => d.places.filter((p) => !p.slotType).length === 0);
  const canSortSelectedDay = !isAllView && normalPlaces.length >= 2;

  // 새 장소가 추가됐을 때 마지막 항목에 애니메이션 트리거 — 300ms 후 초기화
  useEffect(() => {
    const prev = prevPlacesLengthRef.current;
    if (!isAllView && currentPlaces.length > prev) {
      const added = currentPlaces[currentPlaces.length - 1];
      setNewPlaceId(added.place_id);
      const timer = setTimeout(() => setNewPlaceId(null), 300);
      prevPlacesLengthRef.current = currentPlaces.length;
      return () => clearTimeout(timer);
    }
    prevPlacesLengthRef.current = currentPlaces.length;
  }, [currentPlaces, isAllView]);

  const handleSort = async () => {
    if (!selectedDate || normalPlaces.length < 2 || isSorting) return;
    setIsSorting(true);
    try {
      // 슬롯(호텔·공항)은 정렬 대상에서 제외 — 위치가 고정이므로 AI에 넘기지 않음
      const response = await nestApi.post<{ places: { place: GooglePlace; time_slot: string }[] }>(
        '/ai/sort',
        { places: normalPlaces, date: selectedDate },
      );
      const sortedNormal: GooglePlace[] = response.data.places.map((item) => ({ ...item.place, timeSlot: item.time_slot }));
      // 슬롯 순서 유지하면서 일반 장소만 AI 정렬 결과로 교체
      const firstNormalIdx = currentPlaces.findIndex((p) => !p.slotType);
      const lastNormalIdx  = currentPlaces.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
      const beforeSlots = firstNormalIdx === -1 ? [] : currentPlaces.slice(0, firstNormalIdx);
      const afterSlots  = lastNormalIdx  === -1 ? [] : currentPlaces.slice(lastNormalIdx + 1);
      reorderDayPlan(selectedDate, [...beforeSlots, ...sortedNormal, ...afterSlots]);
    } catch (err) {
      console.error('정렬 실패', err);
    } finally {
      setIsSorting(false);
    }
  };

  // AI 일정 자동생성 — Gemini로 장소 목록 생성 후 resolve + 정렬까지 한 번에
  const handleGenerate = async () => {
    if (dayPlans.length === 0 || isGenerating) return;
    const cityName = searchParams || '여행지';

    setIsGenerating(true);
    try {
      const dates = dayPlans.map((d) => d.date);
      const res = await nestApi.post<{
        city: string;
        day_plans: { date: string; city?: string; places: { name: string; category: string; reason: string }[] }[];
      }>('/ai/generate', { city: cityName, dates });

      let totalAdded = 0;
      let totalFailed = 0;

      for (const dp of res.data.day_plans) {
        const existing = dayPlans.find((d) => d.date === dp.date);
        const hasNormal = existing?.places.some((p) => !p.slotType) ?? false;
        // 이미 일반 장소가 있는 날은 건너뜀 — 사용자가 직접 추가한 장소 보호
        if (hasNormal) continue;

        // 사용자 입력 도시 → Gemini 반환 도시 → 대표 도시 순으로 폴백
        const resolveCity = dayCities[dp.date] || dp.city || cityName;
        const resolvedPlaces: GooglePlace[] = [];

        for (const place of dp.places) {
          try {
            const resolved = await nestApi.post<GooglePlace | null>(
              '/place-search/resolve',
              { name: place.name, city: resolveCity, category: place.category },
            );
            if (resolved.data) {
              const gp = { ...resolved.data, rating: null, category: place.category };
              addPlaceToDayPlan(dp.date, gp);
              resolvedPlaces.push(gp);
              totalAdded++;
            } else {
              totalFailed++;
            }
          } catch {
            totalFailed++;
          }
        }

        // 날짜별 장소 삽입 후 /ai/sort 호출 — timeSlot 부여 및 동선 정렬
        if (resolvedPlaces.length >= 2) {
          try {
            const sortRes = await nestApi.post<{ places: { place: GooglePlace; time_slot: string }[] }>(
              '/ai/sort',
              { places: resolvedPlaces, date: dp.date },
            );
            const slotPlaces = sortRes.data.places.map((item) => ({ ...item.place, timeSlot: item.time_slot }));
            // 슬롯(호텔·공항) 앞뒤 위치 유지 — 첫/마지막 일반 장소 인덱스 기준으로 분리
            // 모든 슬롯을 앞에 몰면 체크아웃·도착 공항 같은 후반 슬롯도 앞에 붙는 문제 방지
            const existingPlaces = existing?.places ?? [];
            const firstNormalIdx = existingPlaces.findIndex((p) => !p.slotType);
            const lastNormalIdx = existingPlaces.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
            let beforeSlots: typeof existingPlaces;
            let afterSlots: typeof existingPlaces;
            if (firstNormalIdx === -1) {
              // 슬롯만 있던 날: dayIndex 기준으로 applyTripConfig와 동일하게 before/after 분리
              // applyTripConfig 로직: 첫날은 공항 2개 before + 호텔 after, 중간날 호텔 before+after, 마지막날 호텔 before + 공항 after
              const dayIndex = dayPlans.findIndex((d) => d.date === dp.date);
              const isFirst = dayIndex === 0;
              const isLast = dayIndex === dayPlans.length - 1;
              if (isFirst) {
                // 첫날: airport_depart, airport_arrive → before / hotel → after
                beforeSlots = existingPlaces.filter((p) => p.slotType === 'airport_depart' || p.slotType === 'airport_arrive');
                afterSlots = existingPlaces.filter((p) => p.slotType === 'hotel');
              } else if (isLast) {
                // 마지막날: hotel → before / airport_arrive → after
                beforeSlots = existingPlaces.filter((p) => p.slotType === 'hotel');
                afterSlots = existingPlaces.filter((p) => p.slotType === 'airport_arrive');
              } else {
                // 중간날: 첫 hotel → before, 나머지 → after
                const hotelSlots = existingPlaces.filter((p) => p.slotType === 'hotel');
                beforeSlots = hotelSlots.slice(0, 1);
                afterSlots = hotelSlots.slice(1);
              }
            } else {
              beforeSlots = existingPlaces.slice(0, firstNormalIdx);
              afterSlots = lastNormalIdx === -1 ? [] : existingPlaces.slice(lastNormalIdx + 1);
            }
            reorderDayPlan(dp.date, [...beforeSlots, ...slotPlaces, ...afterSlots]);
          } catch {
            // 정렬 실패는 이미 추가된 장소 유지 — 사용자에게 별도 안내
          }
        }
      }

      // 결과 피드백
      if (totalAdded === 0) {
        show('장소 정보를 가져오지 못했어요. 다시 시도해 주세요.', 'error');
      } else if (totalFailed > 0) {
        show(`${totalAdded}개 추가 완료, ${totalFailed}개는 찾을 수 없어 건너뛰었어요.`, 'warning');
      } else {
        show(`${totalAdded}개 장소를 일정에 추가하고 정렬했어요.`, 'success');
      }
    } catch {
      show('일정 자동생성에 실패했어요. 잠시 후 다시 시도해 주세요.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // 드래그 종료 — 슬롯이 아닌 일반 장소만 재정렬, 슬롯은 앞뒤 위치 유지
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || isAllView) return;
    const oldIndex = normalPlaces.findIndex((p) => p.place_id === active.id);
    const newIndex = normalPlaces.findIndex((p) => p.place_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(normalPlaces, oldIndex, newIndex);

    // 앞 슬롯: currentPlaces에서 첫 번째 일반 장소 이전에 있는 슬롯들
    const firstNormalIdx = currentPlaces.findIndex((p) => !p.slotType);
    const beforeSlots = firstNormalIdx === -1 ? [] : currentPlaces.slice(0, firstNormalIdx).filter((p) => p.slotType);
    // 뒤 슬롯: 마지막 일반 장소 이후에 있는 슬롯들
    const lastNormalIdx = currentPlaces.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
    const afterSlots = lastNormalIdx === -1 ? [] : currentPlaces.slice(lastNormalIdx + 1).filter((p) => p.slotType);

    reorderDayPlan(selectedDate, [...beforeSlots, ...reordered, ...afterSlots]);
  };

  const currentDayColor = selectedDate && selectedDate !== 'all' ? getDayColor(selectedDate, dayPlans) : DAY_COLORS[0];

  if (isCollapsed) {
    return (
      // 접힌 상태 — 얇은 세로 탭만 표시, 클릭 시 펼침 (데스크톱 전용 — 모바일에선 접기 버튼이 숨겨져 진입 불가)
      <div className="h-full hidden md:flex flex-col items-center justify-center bg-white dark:bg-[#2c2c2e] border-r border-gray-100 dark:border-white/8 w-full cursor-pointer group transition-all"
        onClick={() => onCollapse(false)}
      >
        <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-white/30 group-hover:text-gray-700 dark:group-hover:text-[#60A5FA] transition-colors">
          <ChevronRight size={16} />
          {/* 세로 텍스트 */}
          <span className="text-xs font-semibold tracking-widest" style={{ writingMode: 'vertical-rl' }}>
            일정
          </span>
          {/* 장소 개수 뱃지 */}
          {currentPlaces.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center">
              {currentPlaces.length}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#2c2c2e] border-r border-gray-100 dark:border-white/8 relative">

      {/* AI 작업 중 스피너 오버레이 */}
      {(isSorting || isGenerating) && (
        <div className="absolute inset-0 bg-white/75 dark:bg-black/60 flex flex-col items-center justify-center z-10 gap-3">
          <div className="w-9 h-9 border-4 border-[#DBEAFE] dark:border-[#1e3a5f] border-t-[#2563EB] rounded-full animate-spin" />
          <span className="text-sm font-bold text-[#2563EB] dark:text-[#60A5FA]">
            {isGenerating ? 'AI 일정 생성 중...' : 'AI 정렬 중...'}
          </span>
        </div>
      )}

      {/* Day 탭 */}
      <div className="flex items-center gap-2 px-3 py-2.5 overflow-x-auto border-b border-gray-100 dark:border-white/8 flex-shrink-0">
        <button
          onClick={() => setSelectedDate('all')}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer
            ${isAllView
              ? 'bg-gray-900 text-white dark:bg-[#2563EB] shadow-sm'
              : 'bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/12'
            }`}
        >
          전체보기
        </button>
        {dayPlans.map((day, index) => {
          const dayColor = getDayColor(day.date, dayPlans);
          const isActive = selectedDate === day.date;
          return (
            <button
              key={day.date}
              onClick={() => setSelectedDate(day.date)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer
                ${isActive
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/12'
                }`}
              style={isActive ? { background: dayColor, boxShadow: `0 2px 8px ${dayColor}55` } : undefined}
            >
              Day {index + 1}
            </button>
          );
        })}
        {/* 접기 버튼 — 데스크톱 전용, 탭 오른쪽 끝 고정 */}
        <button
          onClick={() => onCollapse(true)}
          className="hidden md:block ml-auto flex-shrink-0 p-1 rounded-xl text-gray-400 dark:text-white/30 hover:text-gray-800 dark:hover:text-[#60A5FA] hover:bg-gray-100 dark:hover:bg-white/8 transition-colors cursor-pointer"
          title="패널 접기"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* 장소 목록 */}
      <div className="flex-1 overflow-y-auto px-3 pt-3">
        {/* 빈 상태 */}
        {currentPlaces.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-white/20 gap-2">
            <ClipboardList size={40} strokeWidth={1.5} />
            <span className="text-sm">
              {dayPlans.length === 0 ? '날짜를 먼저 선택해주세요' : '장소를 추가해보세요'}
            </span>
          </div>
        )}

        {isAllView
          ? dayPlans.map((day, dayIndex) => {
              const dayColor = getDayColor(day.date, dayPlans);
              let normalIdx = 0;
              return (
                <div key={day.date} className="mb-5">
                  <div
                    className="text-xs font-bold mb-2.5 pb-1.5 border-b"
                    style={{ color: dayColor, borderColor: dayColor + '33' }}
                  >
                    Day {dayIndex + 1} · {day.date}
                  </div>
                  {day.places.map((place, index) => {
                    const isLast = index === day.places.length - 1;
                    if (place.slotType) {
                      const firstNormalIdx = day.places.findIndex((p) => !p.slotType);
                      const isBeforeSlot = firstNormalIdx === -1 || index < firstNormalIdx;
                      return (
                        <SlotItem
                          key={`${place.place_id}-${place.slotType}-${index}`}
                          place={place}
                          isLast={isLast}
                          color={dayColor}
                          date={day.date}
                          dayIndex={dayIndex}
                          totalDays={dayPlans.length}
                          isBeforeSlot={isBeforeSlot}
                          onEditSlot={(date, slotType) => setSlotEdit({ date, slotType })}
                        />
                      );
                    }
                    const num = normalIdx++;
                    return (
                      <PlaceItem
                        key={place.place_id}
                        place={place}
                        index={num}
                        isLast={isLast}
                        color={dayColor}
                        onRemove={() => removePlaceFromDayPlan(day.date, place.place_id)}
                        setDetailPlace={setDetailPlace}
                      />
                    );
                  })}
                </div>
              );
            })
          : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={normalPlaces.map((p) => p.place_id)}
                strategy={verticalListSortingStrategy}
              >
                {/* 슬롯(공항·호텔) 중 일반 장소 앞에 위치한 것들 */}
                {currentPlaces
                  .filter((p) => p.slotType && currentPlaces.findIndex((x) => !x.slotType) > currentPlaces.indexOf(p))
                  .map((place, index) => {
                    const currentDayIndex = dayPlans.findIndex((d) => d.date === selectedDate);
                    return (
                      <SlotItem
                        key={`${place.place_id}-${place.slotType}-before-${index}`}
                        place={place}
                        isLast={false}
                        color={currentDayColor}
                        date={selectedDate}
                        dayIndex={currentDayIndex}
                        totalDays={dayPlans.length}
                        isBeforeSlot={true}
                        onEditSlot={(date, slotType) => setSlotEdit({ date, slotType })}
                      />
                    );
                  })}

                {/* 일반 장소 — 카테고리가 있으면 섹션별 그룹핑, 없으면 순서대로 */}
                {(() => {
                  const hasCat = normalPlaces.some((p) => p.category);
                  if (!hasCat) {
                    return normalPlaces.map((place, normalIndex) => {
                      const globalIndex = currentPlaces.indexOf(place);
                      const isLast = globalIndex === currentPlaces.length - 1;
                      return (
                        <SortablePlaceItem
                          key={place.place_id}
                          place={place}
                          index={normalIndex}
                          isLast={isLast}
                          color={currentDayColor}
                          onRemove={() => removePlaceFromDayPlan(selectedDate, place.place_id)}
                          setDetailPlace={setDetailPlace}
                          isNew={place.place_id === newPlaceId}
                        />
                      );
                    });
                  }

                  // 카테고리별 그룹핑
                  const grouped = new Map<string, GooglePlace[]>();
                  for (const place of normalPlaces) {
                    const cat = place.category ?? '기타';
                    if (!grouped.has(cat)) grouped.set(cat, []);
                    grouped.get(cat)!.push(place);
                  }
                  const orderedCats = [
                    ...CATEGORY_ORDER.filter((c) => grouped.has(c)),
                    ...[...grouped.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
                  ];

                  return orderedCats.map((cat) => {
                    const places = grouped.get(cat)!;
                    return (
                      <div key={cat} className="mb-2">
                        <div className="flex items-center gap-1.5 px-1 py-1.5 mb-1">
                          <span className="text-sm">{CATEGORY_EMOJI[cat] ?? '📍'}</span>
                          <span className="text-xs font-bold text-[#0f172a]/50 dark:text-white/30">{cat}</span>
                          <span className="text-[10px] text-[#0f172a]/30 dark:text-white/20">· {places.length}곳</span>
                        </div>
                        {places.map((place, normalIndex) => {
                          const isLast = normalIndex === places.length - 1;
                          return (
                            <SortablePlaceItem
                              key={place.place_id}
                              place={place}
                              index={normalPlaces.indexOf(place)}
                              isLast={isLast}
                              color={currentDayColor}
                              onRemove={() => removePlaceFromDayPlan(selectedDate, place.place_id)}
                              setDetailPlace={setDetailPlace}
                              isNew={place.place_id === newPlaceId}
                            />
                          );
                        })}
                      </div>
                    );
                  });
                })()}

                {/* 슬롯 중 일반 장소 뒤에 위치한 것들 */}
                {currentPlaces
                  .filter((p) => {
                    if (!p.slotType) return false;
                    const lastNormalIdx = currentPlaces.map((x, i) => (!x.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
                    return currentPlaces.indexOf(p) > lastNormalIdx;
                  })
                  .map((place, index) => {
                    const currentDayIndex = dayPlans.findIndex((d) => d.date === selectedDate);
                    const isLast = index === currentPlaces.filter((p) => {
                      const lastNormalIdx = currentPlaces.map((x, i) => (!x.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
                      return p.slotType && currentPlaces.indexOf(p) > lastNormalIdx;
                    }).length - 1;
                    return (
                      <SlotItem
                        key={`${place.place_id}-${place.slotType}-after-${index}`}
                        place={place}
                        isLast={isLast}
                        color={currentDayColor}
                        date={selectedDate}
                        dayIndex={currentDayIndex}
                        totalDays={dayPlans.length}
                        isBeforeSlot={false}
                        onEditSlot={(date, slotType) => setSlotEdit({ date, slotType })}
                      />
                    );
                  })}
              </SortableContext>
            </DndContext>
          )
        }
      </div>

      {/* FAB: AI 정렬 — 날짜 선택 + 일반 장소 2개 이상 + 작업 중이 아닐 때만 표시 */}
      {canSortSelectedDay && !isSorting && !isGenerating && (
        <button
          onClick={handleSort}
          title="AI 자동 정렬"
          className="absolute bottom-16 right-4 w-12 h-12 rounded-full bg-gray-900 hover:bg-gray-700 dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] active:scale-95 text-white text-lg shadow-xl flex items-center justify-center transition-all cursor-pointer z-10"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
        >
          <Sparkles size={20} />
        </button>
      )}

      {/* FAB: AI 일정 자동생성 — 빈 날짜가 있고 현재 날짜를 정렬할 수 없을 때 표시 */}
      {hasEmptyNormalDay && !canSortSelectedDay && !isGenerating && !isSorting && (
        <button
          onClick={() => {
            setDayCities({});
            setShowCityInput(true);
          }}
          title="AI로 일정 채우기"
          className="absolute bottom-16 right-4 w-auto px-4 h-12 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] active:scale-95 text-white text-sm font-bold shadow-xl flex items-center gap-2 transition-all cursor-pointer z-10"
          style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.35)' }}
        >
          <Sparkles size={16} />
          AI로 채우기
        </button>
      )}

      {/* 날짜별 도시 입력 모달 */}
      {showCityInput && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl shadow-2xl w-[300px] max-h-[480px] flex flex-col overflow-hidden border border-[#DBEAFE]/60 dark:border-white/8">
            {/* 헤더 */}
            <div className="px-5 pt-5 pb-3">
              <p className="text-sm font-bold text-[#0f172a] dark:text-white">날짜별 여행 도시</p>
              <p className="text-xs text-[#0f172a]/40 dark:text-white/30 mt-0.5">비워두면 AI가 자동으로 도시를 배분해요</p>
            </div>

            {/* 날짜 목록 */}
            <div className="flex-1 overflow-y-auto px-5 space-y-2 pb-3">
              {dayPlans.map((dp, i) => (
                <div key={dp.date} className="flex items-center gap-2">
                  <span className="text-xs text-[#0f172a]/50 dark:text-white/30 w-12 flex-shrink-0">Day {i + 1}</span>
                  <input
                    type="text"
                    value={dayCities[dp.date] ?? ''}
                    onChange={(e) => setDayCities((prev) => ({ ...prev, [dp.date]: e.target.value }))}
                    placeholder={searchParams || '도시명'}
                    className="flex-1 text-xs px-3 py-2 rounded-xl border border-[#DBEAFE] dark:border-white/10 bg-[#F8FAFF] dark:bg-[#252527] text-[#0f172a] dark:text-white/80 placeholder:text-gray-300 dark:placeholder:text-white/20 outline-none focus:border-[#2563EB]/50 dark:focus:border-[#3B82F6]/50 transition-colors"
                  />
                </div>
              ))}
            </div>

            {/* 버튼 */}
            <div className="px-5 pb-5 pt-2 flex gap-2">
              <Button variant="ghost" onClick={() => setShowCityInput(false)} className="flex-1">취소</Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  setShowCityInput(false);
                  void handleGenerate();
                }}
              >
                <Sparkles size={13} className="mr-1" />
                생성하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="flex gap-2 p-3 border-t border-gray-100 dark:border-white/8">
        {/* 여행 설정 버튼 — 날짜가 설정된 경우에만 표시 */}
        {dayPlans.length > 0 && (
          <button
            onClick={() => setShowTripSetup(true)}
            title="공항·호텔 설정"
            className="p-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/30 hover:border-[#2563EB]/40 hover:text-[#2563EB] dark:hover:border-[#3B82F6]/40 dark:hover:text-[#60A5FA] transition-colors cursor-pointer"
          >
            <Settings2 size={16} />
          </button>
        )}
        <Button
          variant="danger"
          onClick={() => setShowClearConfirm(true)}
          className="flex-1"
        >
          {isAllView ? '전체 초기화' : '오늘 초기화'}
        </Button>
        {/* 장소가 하나라도 있을 때만 저장 버튼 표시 */}
        {dayPlans.some((d) => d.places.length > 0) && (
          <Button
            variant="primary"
            onClick={() => setShowSaveModal(true)}
            className="flex-1"
          >
            저장
          </Button>
        )}
      </div>

      {/* 장소 상세 패널 */}
      {detailPlace && <PlaceDetailContainer />}

      {/* 여행 기본 설정 모달 */}
      {showTripSetup && <TripSetupModal onClose={() => setShowTripSetup(false)} />}

      {/* 슬롯 개별 변경 모달 */}
      {slotEdit && (
        <SlotEditModal
          date={slotEdit.date}
          slotType={slotEdit.slotType}
          onClose={() => setSlotEdit(null)}
        />
      )}

      {/* 저장 모달 */}
      {showSaveModal && (
        <SavePlanModal
          onClose={() => setShowSaveModal(false)}
          onSaved={() => {
            setShowSaveModal(false);
            fullReset();
            router.push('/mypage');
          }}
        />
      )}

      {/* 초기화 확인 모달 */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl w-[300px] p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white/90">
                {isAllView ? '전체 일정을 초기화할까요?' : '이 날의 장소를 모두 삭제할까요?'}
              </p>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                {isAllView ? '모든 날짜의 장소가 삭제됩니다.' : '삭제 후 되돌릴 수 없습니다.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowClearConfirm(false)} className="flex-1">
                취소
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (isAllView) {
                    clearDayPlans();
                  } else {
                    // 슬롯은 유지하고 일반 장소만 삭제
                    reorderDayPlan(selectedDate, currentPlaces.filter((p) => p.slotType));
                  }
                  setShowClearConfirm(false);
                }}
                className="flex-1"
              >
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanContainer;
