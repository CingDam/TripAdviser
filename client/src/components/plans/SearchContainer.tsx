'use client';
import { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Star, Info, Plus, Map } from 'lucide-react';
import usePlanStore, { GooglePlace } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import Button from '@/components/common/Button';
import Calendar from './Calender';
import { SearchType } from '@/hook/usePlaceSearch';
import { getTag } from '@/utils/placeUtils';

// SearchType → Google 공식 장소 타입 매핑
// place.types 배열에 이 중 하나라도 포함되면 해당 카테고리로 분류
const CATEGORY_GOOGLE_TYPES: Record<SearchType, string[]> = {
  tourist:       ['tourist_attraction', 'museum', 'art_gallery', 'amusement_park', 'zoo', 'park', 'landmark'],
  restaurant:    ['restaurant', 'food', 'meal_takeaway', 'meal_delivery'],
  cafe:          ['cafe', 'bakery', 'coffee_shop'],
  shopping:      ['shopping_mall', 'department_store', 'store', 'supermarket', 'market', 'clothing_store'],
  bar:           ['bar', 'night_club', 'pub'],
  train_station: ['train_station', 'transit_station', 'subway_station', 'bus_station', 'light_rail_station'],
};

const CATEGORIES: { label: string; type: SearchType }[] = [
  { label: '관광지', type: 'tourist' },
  { label: '식당',   type: 'restaurant' },
  { label: '카페',   type: 'cafe' },
  { label: '바',     type: 'bar' },
  { label: '쇼핑',   type: 'shopping' },
  { label: '역',     type: 'train_station' },
];

// 스켈레톤 카드 — 실제 카드 레이아웃과 동일한 구조로 shimmer 효과
const SkeletonCard = () => (
  <div className="flex gap-3 px-3 py-3 border-b border-gray-50 dark:border-white/5">
    <div className="skeleton w-14 h-14 flex-shrink-0 rounded-xl" />
    <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
      <div className="skeleton h-4 rounded-full w-3/4" />
      <div className="skeleton h-3 rounded-full w-1/2" />
      <div className="flex gap-2 mt-1">
        <div className="skeleton h-6 rounded-lg w-16" />
        <div className="skeleton h-6 rounded-lg w-20" />
      </div>
    </div>
  </div>
);

const SearchContainer = ({ initialQuery }: { initialQuery?: string | null }) => {
  const [inputVal, setInputVal] = useState(initialQuery ?? '');
  const setSearchParams        = usePlanStore((s) => s.setSearchParams);
  const searchResults          = usePlanStore((s) => s.searchResults);
  const setSelectedPlace       = usePlanStore((s) => s.setSelectedPlace);
  const setDetailPlace         = usePlanStore((s) => s.setDetailPlace);
  const addPlaceToDayPlan      = usePlanStore((s) => s.addPlaceToDayPlan);
  const selectedDate           = usePlanStore((s) => s.selectedDate);
  const searchTypes            = usePlanStore((s) => s.searchTypes);
  const setSearchTypes         = usePlanStore((s) => s.setSearchTypes);
  const isSearching            = usePlanStore((s) => s.isSearching);
  const calendarResetKey       = usePlanStore((s) => s.calendarResetKey);
  const { show }               = useSnackbar();

  // 도시 링크로 진입 시 자동 검색 1회만 실행
  useEffect(() => {
    if (initialQuery) setSearchParams(initialQuery);
    // initialQuery는 서버에서 전달된 정적 prop으로 마운트 후 변경되지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryClick = (type: SearchType) => {
    // API 재호출 없이 상태만 변경 → 아래 filteredResults에서 클라이언트 필터링
    setSearchTypes(searchTypes.includes(type) ? [] : [type]);
  };

  // 카테고리 선택 시 기존 결과를 클라이언트에서 필터링 — 새 API 호출 없음
  // 선택 없으면 전체 표시, 선택 있으면 place.types에 해당 Google 타입이 하나라도 포함된 것만 표시
  const filteredResults = searchTypes.length === 0
    ? searchResults
    : searchResults.filter((place) =>
        searchTypes.some((cat) =>
          CATEGORY_GOOGLE_TYPES[cat].some((t) => place.types.includes(t))
        )
      );

  const handleSearch = () => {
    if (!inputVal.trim()) return;
    setSearchParams(inputVal);
  };

  // 검색 결과가 이미 있는 상태에서 재검색 중이면 상단 shimmer 진행 바 표시
  // 결과가 없는 첫 검색 중이면 스켈레톤 카드 표시
  // 새 검색 결과가 오면 스크롤을 맨 위로 리셋
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [searchResults]);

  const showProgressBar = isSearching && searchResults.length > 0;
  const showSkeleton    = isSearching && searchResults.length === 0;
  // skeleton은 전체 결과 기준 (필터 적용 전)

  return (
    // flex-shrink-0: MapContainer의 flex-1 계산에 의해 너비가 줄어들지 않도록 고정
    <div className="w-[20%] h-full flex flex-col bg-white dark:bg-[#2c2c2e] border-r border-gray-100 dark:border-white/8 shadow-sm flex-shrink-0">

      {/* 검색창 */}
      <div className="p-3 border-b border-gray-100 dark:border-white/8">
        <div className="flex gap-2">
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="장소, 도시 검색..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
          />
          <Button variant="primary" size="sm" onClick={handleSearch}>
            <Search size={16} />
          </Button>
        </div>
      </div>

      {/* 날짜 선택 — calendarResetKey 변경 시 강제 리마운트해서 로컬 range 상태 초기화 */}
      <Calendar key={calendarResetKey} />

      {/* 카테고리 필터 — flex-wrap 대신 overflow-x-auto로 고정 높이 유지 */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-gray-100 dark:border-white/8 flex-shrink-0">
        {CATEGORIES.map(({ label, type }) => {
          const isActive = searchTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => handleCategoryClick(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer flex-shrink-0
                ${isActive
                  ? 'bg-gray-900 border-gray-900 text-white dark:bg-indigo-600 dark:border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/45 hover:border-gray-400 hover:text-gray-800 dark:hover:border-indigo-400/50 dark:hover:text-indigo-400'
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 검색 결과 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">

        {/* 재검색 중 상단 shimmer 진행 바 — 기존 결과는 그대로 보이면서 업데이트 중임을 표시 */}
        {showProgressBar && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-100 dark:bg-indigo-900/40 z-10 overflow-hidden">
            <div
              className="h-full w-1/4 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
              style={{ animation: 'shimmerProgress 1.2s ease-in-out infinite' }}
            />
          </div>
        )}

        {/* 첫 검색 중 스켈레톤 카드 */}
        {showSkeleton && (
          <>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </>
        )}

        {/* 빈 상태 — 검색 중이 아니고 결과도 없을 때 */}
        {!isSearching && filteredResults.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-white/20 gap-2">
            <Map size={40} strokeWidth={1.5} />
            <span className="text-sm">지도를 움직이면 주변 장소가 표시됩니다</span>
          </div>
        )}

        {filteredResults.map((result: GooglePlace) => (
          <div
            key={result.place_id}
            onClick={() => setSelectedPlace(result)}
            className="flex gap-3 px-3 py-3 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            {/* 썸네일 자리 */}
            <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-300 dark:text-indigo-400/50">
              <MapPin size={22} strokeWidth={1.5} />
            </div>

            {/* 텍스트 영역 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm font-semibold truncate max-w-[120px] text-gray-900 dark:text-white/90">{result.name}</strong>
                {result.rating && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-400 font-medium">
                    <Star size={11} fill="currentColor" strokeWidth={0} />
                    {result.rating}
                  </span>
                )}
                {(() => {
                  const tag = getTag(result.types ?? []);
                  return tag ? (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: tag.color + '22', color: tag.color }}
                    >
                      {tag.label}
                    </span>
                  ) : null;
                })()}
              </div>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 truncate max-w-[80%]">
                {result.formatted_address}
              </p>

              {/* 버튼 */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setDetailPlace(result); }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/40 hover:border-gray-400 hover:text-gray-800 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <Info size={11} />
                  자세히
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selectedDate) { show('날짜를 먼저 선택해주세요!', 'warning'); return; }
                    addPlaceToDayPlan(selectedDate, result);
                  }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gray-900 dark:bg-indigo-500/10 border border-gray-900 dark:border-indigo-500/30 text-white dark:text-indigo-400 hover:bg-gray-700 dark:hover:bg-indigo-500/20 transition-colors cursor-pointer font-medium"
                >
                  <Plus size={11} />
                  일정추가
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchContainer;
