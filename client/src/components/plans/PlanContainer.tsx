"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GripVertical, MapPin, Star, ClipboardList, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import usePlanStore, { GooglePlace } from '@/store/usePlanStore'
import { aiApi } from '@/config/api.config'
import PlaceDetailContainer from './PlaceDetailContainer'
import SavePlanModal from './SavePlanModal'
import { getTag } from '@/utils/placeUtils'
import { DAY_COLORS, getDayColor } from '@/constants/dayColors'
import Button from '@/components/common/Button'
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

// 타임라인 장소 카드 — 번호 원 + 세로 연결선 + 썸네일 + 정보
const PlaceItem = ({
  place, index, isLast, color, onRemove, setDetailPlace, dragHandleProps,
}: {
  place: GooglePlace;
  index: number;
  isLast: boolean;
  color: string;
  onRemove: () => void;
  setDetailPlace: (p: GooglePlace) => void;
  // dragHandleProps: useSortable listeners — 드래그 핸들에 spread해서 드래그 이벤트 바인딩
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}) => {
  const tag = getTag(place.types ?? []);
  return (
    <div className="flex gap-3">
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
          {/* 썸네일 자리 */}
          <div className="flex-shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-200 dark:text-indigo-400/40"
            style={{ width: 52, height: 52 }}>
            <MapPin size={20} strokeWidth={1.5} />
          </div>
          {/* 텍스트 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <strong className="text-sm font-semibold truncate max-w-[100px] text-gray-900 dark:text-white/90 group-hover:text-gray-500 dark:group-hover:text-indigo-400 transition-colors">
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

const PlanContainer = () => {
  const dayPlans             = usePlanStore((s) => s.dayPlans);
  const selectedDate         = usePlanStore((s) => s.selectedDate);
  const setSelectedDate      = usePlanStore((s) => s.setSelectedDate);
  const removePlaceFromDayPlan = usePlanStore((s) => s.removePlaceFromDayPlan);
  const clearDayPlans        = usePlanStore((s) => s.clearDayPlans);
  const reorderDayPlan       = usePlanStore((s) => s.reorderDayPlan);
  const fullReset            = usePlanStore((s) => s.fullReset);
  const detailPlace          = usePlanStore((s) => s.detailPlace);
  const setDetailPlace       = usePlanStore((s) => s.setDetailPlace);

  const router = useRouter();
  const [isSorting, setIsSorting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // PointerSensor: 마우스/터치 드래그 — activationConstraint로 클릭과 구분 (8px 이동 후 활성화)
  // KeyboardSensor: 키보드 접근성 지원
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const isAllView = selectedDate === 'all';
  const currentPlaces = isAllView
    ? dayPlans.flatMap((d) => d.places)
    : dayPlans.find((d) => d.date === selectedDate)?.places ?? [];

  const handleSort = async () => {
    if (!selectedDate || currentPlaces.length < 2 || isSorting) return;
    setIsSorting(true);
    try {
      const response = await aiApi.post('/api/sort', { places: currentPlaces, date: selectedDate });
      reorderDayPlan(selectedDate, response.data.places);
    } catch (err) {
      console.error('정렬 실패', err);
    } finally {
      setIsSorting(false);
    }
  };

  // 드래그 종료 — active/over id로 순서 변경
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || isAllView) return;
    const oldIndex = currentPlaces.findIndex((p) => p.place_id === active.id);
    const newIndex = currentPlaces.findIndex((p) => p.place_id === over.id);
    reorderDayPlan(selectedDate, arrayMove(currentPlaces, oldIndex, newIndex));
  };

  const currentDayColor = selectedDate && selectedDate !== 'all' ? getDayColor(selectedDate, dayPlans) : DAY_COLORS[0];

  if (isCollapsed) {
    return (
      // 접힌 상태 — 얇은 세로 탭만 표시, 클릭 시 펼침
      <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-[#2c2c2e] border-r border-gray-100 dark:border-white/8 flex-shrink-0 w-10 cursor-pointer group transition-all"
        onClick={() => setIsCollapsed(false)}
      >
        <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-white/30 group-hover:text-gray-700 dark:group-hover:text-indigo-400 transition-colors">
          <ChevronRight size={16} />
          {/* 세로 텍스트 */}
          <span className="text-xs font-semibold tracking-widest" style={{ writingMode: 'vertical-rl' }}>
            일정
          </span>
          {/* 장소 개수 뱃지 */}
          {currentPlaces.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
              {currentPlaces.length}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[20%] h-full flex flex-col bg-white dark:bg-[#2c2c2e] border-r border-gray-100 dark:border-white/8 relative">

      {/* AI 정렬 중 스피너 오버레이 */}
      {isSorting && (
        <div className="absolute inset-0 bg-white/75 dark:bg-black/60 flex flex-col items-center justify-center z-10 gap-3">
          <div className="w-9 h-9 border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 rounded-full animate-spin" />
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">AI 정렬 중...</span>
        </div>
      )}

      {/* Day 탭 */}
      <div className="flex items-center gap-2 px-3 py-2.5 overflow-x-auto border-b border-gray-100 dark:border-white/8 flex-shrink-0">
        <button
          onClick={() => setSelectedDate('all')}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer
            ${isAllView
              ? 'bg-gray-900 text-white dark:bg-indigo-600 shadow-sm'
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
        {/* 접기 버튼 — 탭 오른쪽 끝 고정 */}
        <button
          onClick={() => setIsCollapsed(true)}
          className="ml-auto flex-shrink-0 p-1 rounded-xl text-gray-400 dark:text-white/30 hover:text-gray-800 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors cursor-pointer"
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
          ? dayPlans.map((day, dayIndex) => (
              <div key={day.date} className="mb-5">
                <div
                  className="text-xs font-bold mb-2.5 pb-1.5 border-b"
                  style={{ color: getDayColor(day.date, dayPlans), borderColor: getDayColor(day.date, dayPlans) + '33' }}
                >
                  Day {dayIndex + 1} · {day.date}
                </div>
                {day.places.map((place, index) => (
                  // 전체보기에서는 드래그 비활성 — 날짜별 개별 정렬만 지원
                  <PlaceItem
                    key={place.place_id}
                    place={place}
                    index={index}
                    isLast={index === day.places.length - 1}
                    color={getDayColor(day.date, dayPlans)}
                    onRemove={() => removePlaceFromDayPlan(day.date, place.place_id)}
                    setDetailPlace={setDetailPlace}
                  />
                ))}
              </div>
            ))
          : (
            // DndContext: 드래그 이벤트 공급자 — sensors로 입력 감지, onDragEnd로 순서 업데이트
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              {/* SortableContext: 정렬 가능한 아이템 목록 — items는 고유 id 배열 */}
              <SortableContext
                items={currentPlaces.map((p) => p.place_id)}
                strategy={verticalListSortingStrategy}
              >
                {currentPlaces.map((place: GooglePlace, index) => (
                  <SortablePlaceItem
                    key={place.place_id}
                    place={place}
                    index={index}
                    isLast={index === currentPlaces.length - 1}
                    color={currentDayColor}
                    onRemove={() => removePlaceFromDayPlan(selectedDate, place.place_id)}
                    setDetailPlace={setDetailPlace}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )
        }
      </div>

      {/* FAB: AI 정렬 — 날짜 선택 + 2개 이상 장소 + 정렬 중이 아닐 때만 표시 */}
      {!isAllView && currentPlaces.length >= 2 && !isSorting && (
        <button
          onClick={handleSort}
          title="AI 자동 정렬"
          className="absolute bottom-16 right-4 w-12 h-12 rounded-full bg-gray-900 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 active:scale-95 text-white text-lg shadow-xl flex items-center justify-center transition-all cursor-pointer z-10"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
        >
          <Sparkles size={20} />
        </button>
      )}

      {/* 하단 버튼 */}
      <div className="flex gap-2 p-3 border-t border-gray-100 dark:border-white/8">
        <Button
          variant="danger"
          onClick={() => isAllView ? clearDayPlans() : reorderDayPlan(selectedDate, [])}
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
    </div>
  );
};

export default PlanContainer;
