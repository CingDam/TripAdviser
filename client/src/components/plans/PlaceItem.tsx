import { GripVertical, MapPin, Star, Footprints, Car } from 'lucide-react';
import { GooglePlace } from '@/store/usePlanStore';
import { getTag, getPriceLabel } from '@/utils/placeUtils';
import { estimateWalk } from '@/utils/walkEstimate';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 타임라인 장소 카드 — 번호 원 + 세로 연결선 + 썸네일 + 정보
const PlaceItem = ({
  place, index, isLast, color, onRemove, setDetailPlace, dragHandleProps, isNew, nextPlace,
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
  // 다음 장소 — 둘 사이 이동시간 배지 계산용. 마지막 항목이면 undefined
  nextPlace?: GooglePlace;
}) => {
  const tag = getTag(place.types ?? []);
  // 좌표가 유효한 두 장소 사이만 추정 — 0,0(복원분)이면 null로 배지 생략
  const walk = !isLast && nextPlace ? estimateWalk(place.location, nextPlace.location) : null;
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

        {/* 다음 장소까지 이동시간 — Haversine 직선거리 추정(API 호출 없음) */}
        {walk && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/30">
            {walk.isDrive ? <Car size={12} /> : <Footprints size={12} />}
            <span>
              {walk.isDrive
                ? `다음까지 약 ${walk.km.toFixed(1)}km · 차로 이동`
                : `다음까지 도보 약 ${walk.minutes}분`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// 드래그 가능한 PlaceItem 래퍼 — useSortable 훅으로 DnD 바인딩
export const SortablePlaceItem = (props: Omit<Parameters<typeof PlaceItem>[0], 'dragHandleProps'>) => {
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

export default PlaceItem;
