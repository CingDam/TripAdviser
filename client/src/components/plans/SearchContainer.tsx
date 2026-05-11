'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Star, Info, Plus, Trash2, Map } from 'lucide-react';
import usePlanStore, { GooglePlace } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import Button from '@/components/common/Button';
import Calendar from './Calender';
import { SearchType } from '@/hook/usePlaceSearch';
import { getTag, getPriceLabel } from '@/utils/placeUtils';

// SearchType → Google 공식 장소 타입 매핑
// place.types 배열에 이 중 하나라도 포함되면 해당 카테고리로 분류
const CATEGORY_GOOGLE_TYPES: Record<SearchType, string[]> = {
  tourist:   ['tourist_attraction', 'museum', 'art_gallery', 'amusement_park', 'zoo', 'park', 'landmark', 'natural_feature'],
  restaurant: ['restaurant', 'food', 'meal_takeaway', 'meal_delivery'],
  cafe:       ['cafe', 'bakery', 'coffee_shop'],
  shopping:   ['shopping_mall', 'department_store', 'store', 'supermarket', 'market', 'clothing_store'],
  bar:        ['bar', 'night_club', 'pub'],
  hotel:      ['lodging'],
  transport:  ['train_station', 'transit_station', 'subway_station', 'bus_station', 'light_rail_station', 'airport'],
};

const CATEGORIES: { label: string; type: SearchType }[] = [
  { label: '관광지', type: 'tourist' },
  { label: '식당',   type: 'restaurant' },
  { label: '카페',   type: 'cafe' },
  { label: '바',     type: 'bar' },
  { label: '쇼핑',   type: 'shopping' },
  { label: '호텔',   type: 'hotel' },
  { label: '교통',   type: 'transport' },
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
  const searchTypes                = usePlanStore((s) => s.searchTypes);
  const setSearchTypes             = usePlanStore((s) => s.setSearchTypes);
  const incrementSearchTrigger     = usePlanStore((s) => s.incrementSearchTrigger);
  const isSearching            = usePlanStore((s) => s.isSearching);
  const hasMore                = usePlanStore((s) => s.hasMore);
  const isLoadingMore          = usePlanStore((s) => s.isLoadingMore);
  const calendarResetKey       = usePlanStore((s) => s.calendarResetKey);
  const dayPlans               = usePlanStore((s) => s.dayPlans);
  const removePlaceFromDayPlan = usePlanStore((s) => s.removePlaceFromDayPlan);
  const { show }               = useSnackbar();

  // 현재 선택된 날짜의 place_id 집합 — 렌더마다 순회 대신 Set으로 O(1) 조회
  const addedPlaceIds = new Set(
    selectedDate && selectedDate !== 'all'
      ? (dayPlans.find((d) => d.date === selectedDate)?.places ?? []).map((p) => p.place_id)
      : []
  );

  // 도시 링크로 진입 시 자동 검색 1회만 실행
  useEffect(() => {
    if (initialQuery) setSearchParams(initialQuery);
    // initialQuery는 서버에서 전달된 정적 prop으로 마운트 후 변경되지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryClick = (type: SearchType) => {
    if (searchTypes.includes(type)) {
      // 카테고리 해제 — 전체 결과가 필요하므로 이 지역 재검색 트리거
      setSearchTypes([]);
      incrementSearchTrigger();
    } else {
      setSearchTypes([type]);
    }
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
    // 카테고리 선택 상태에서 새 검색 시 필터 초기화 — 검색은 전체 카테고리로 실행
    setSearchTypes([]);
    setSearchParams(inputVal);
  };

  // 새 검색 결과가 오면 스크롤을 맨 위로 리셋 — 첫 번째 결과 place_id 변경이 "새 검색"을 의미
  const scrollRef  = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const firstResultId = searchResults[0]?.place_id ?? null;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [firstResultId]);

  const incrementLoadMoreTrigger = usePlanStore((s) => s.incrementLoadMoreTrigger);

  // sentinel div가 뷰포트에 들어오면 MapHandler에 loadMore 신호 전달
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isSearching) return;
    incrementLoadMoreTrigger();
  }, [hasMore, isLoadingMore, isSearching, incrementLoadMoreTrigger]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) handleLoadMore(); },
      // 스크롤 끝 200px 전에 미리 로드 — 사용자가 빈 화면을 보는 시간 최소화
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  const showProgressBar = isSearching && searchResults.length > 0;
  const showSkeleton    = isSearching && searchResults.length === 0;
  // skeleton은 전체 결과 기준 (필터 적용 전)

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#2c2c2e] border-r border-gray-100 dark:border-white/8 shadow-sm">

      {/* 검색창 */}
      <div className="p-3 border-b border-gray-100 dark:border-white/8">
        <div className="flex gap-2">
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="장소, 도시 검색..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-rose-400 dark:focus:border-rose-500/60 focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/30 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
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
                  ? 'bg-gray-900 border-gray-900 text-white dark:bg-rose-600 dark:border-rose-600 shadow-sm'
                  : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/45 hover:border-gray-400 hover:text-gray-800 dark:hover:border-white/30 dark:hover:text-white/70'
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
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-rose-100 dark:bg-rose-900/40 z-10 overflow-hidden">
            <div
              className="h-full w-1/4 bg-gradient-to-r from-transparent via-rose-500 to-transparent"
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
            {/* 썸네일 — 카테고리별 Lucide 아이콘 + 색상 배경 */}
            {(() => {
              const tag = getTag(result.types ?? []);
              const Icon = tag?.Icon ?? MapPin;
              return (
                <div
                  className="w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center"
                  style={{ background: tag ? tag.color + '18' : '#EFF6FF' }}
                >
                  <Icon size={24} strokeWidth={1.8} style={{ color: tag ? tag.color : '#93C5FD' }} />
                </div>
              );
            })()}

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
                {(() => {
                  const price = getPriceLabel(result.priceLevel);
                  return price ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-white/40">
                      {price}
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
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/40 hover:border-gray-400 hover:text-gray-800 dark:hover:border-white/30 dark:hover:text-white/70 transition-colors cursor-pointer"
                >
                  <Info size={11} />
                  자세히
                </button>
                {addedPlaceIds.has(result.place_id) ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePlaceFromDayPlan(selectedDate!, result.place_id);
                    }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-500/30 text-red-400 dark:text-red-400/80 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer font-medium"
                  >
                    <Trash2 size={11} />
                    삭제하기
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selectedDate || selectedDate === 'all') { show('날짜를 먼저 선택해주세요!', 'warning'); return; }
                      addPlaceToDayPlan(selectedDate, result);
                    }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gray-900 dark:bg-white/10 border border-gray-900 dark:border-white/15 text-white dark:text-white/80 hover:bg-gray-700 dark:hover:bg-white/15 transition-colors cursor-pointer font-medium"
                  >
                    <Plus size={11} />
                    일정추가
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* sentinel — 이 div가 뷰포트에 들어오면 IntersectionObserver가 loadMore 호출 */}
        {hasMore && <div ref={sentinelRef} className="h-1" />}

        {/* 추가 로드 중 스피너 */}
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-gray-200 dark:border-white/15 border-t-[#2563EB] rounded-full animate-spin" />
          </div>
        )}

        {/* 결과 끝 안내 — 더 불러올 게 없고 결과가 있을 때 */}
        {!hasMore && filteredResults.length > 0 && !isSearching && (
          <p className="text-center text-xs text-gray-300 dark:text-white/20 py-4">
            검색 결과를 모두 불러왔습니다
          </p>
        )}
      </div>
    </div>
  );
};

export default SearchContainer;
