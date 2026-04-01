'use client';
import { useState } from 'react';
import { Search, MapPin, Star, Info, Plus, Map } from 'lucide-react';
import usePlanStore, { GooglePlace } from '@/store/usePlanStore';
import Calendar from './Calender';
import { SearchType } from '@/hook/usePlaceSearch';
import placeTypesJson from '@/constants/placeTypes.json';

const CATEGORIES: { label: string; type: SearchType }[] = [
  { label: '관광지', type: 'tourist' },
  { label: '식당',   type: 'restaurant' },
  { label: '카페',   type: 'cafe' },
  { label: '바',     type: 'bar' },
  { label: '쇼핑',   type: 'shopping' },
  { label: '역',     type: 'train_station' },
];

// Record<K, V> = 키 타입이 K이고 값 타입이 V인 객체
// JSON import는 TS가 키를 고정 리터럴로 추론해서 string 인덱싱이 안 되므로 as로 캐스팅
const TYPE_LABEL = placeTypesJson as Record<string, { label: string; color: string }>;

function getTag(types: string[]): { label: string; color: string } | null {
  for (const t of types) {
    if (TYPE_LABEL[t]) return TYPE_LABEL[t];
  }
  return null;
}

// 스켈레톤 카드 — 실제 카드 레이아웃과 동일한 구조로 shimmer 효과
const SkeletonCard = () => (
  <div className="flex gap-3 px-3 py-3 border-b border-gray-50">
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

const SearchContainer = () => {
  const [inputVal, setInputVal] = useState('');
  const setSearchParams        = usePlanStore((s) => s.setSearchParams);
  const searchResults          = usePlanStore((s) => s.searchResults);
  const setSelectedPlace       = usePlanStore((s) => s.setSelectedPlace);
  const setDetailPlace         = usePlanStore((s) => s.setDetailPlace);
  const addPlaceToDayPlan      = usePlanStore((s) => s.addPlaceToDayPlan);
  const selectedDate           = usePlanStore((s) => s.selectedDate);
  const searchTypes            = usePlanStore((s) => s.searchTypes);
  const setSearchTypes         = usePlanStore((s) => s.setSearchTypes);
  const incrementSearchTrigger = usePlanStore((s) => s.incrementSearchTrigger);
  const isSearching            = usePlanStore((s) => s.isSearching);

  const handleCategoryClick = (type: SearchType) => {
    // 이미 선택된 카테고리 클릭 시 해제, 아니면 해당 카테고리만 선택
    setSearchTypes(searchTypes.includes(type) ? [] : [type]);
    incrementSearchTrigger();
  };

  const handleSearch = () => {
    if (!inputVal.trim()) return;
    setSearchParams(inputVal);
  };

  // 검색 결과가 이미 있는 상태에서 재검색 중이면 상단 shimmer 진행 바 표시
  // 결과가 없는 첫 검색 중이면 스켈레톤 카드 표시
  const showProgressBar = isSearching && searchResults.length > 0;
  const showSkeleton    = isSearching && searchResults.length === 0;

  return (
    // flex-shrink-0: MapContainer의 flex-1 계산에 의해 너비가 줄어들지 않도록 고정
    <div className="w-[20%] h-full flex flex-col bg-white border-r border-gray-100 shadow-sm flex-shrink-0">

      {/* 검색창 */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="장소, 도시 검색..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
          >
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* 날짜 선택 */}
      <Calendar />

      {/* 카테고리 필터 — flex-wrap 대신 overflow-x-auto로 고정 높이 유지 */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-gray-100 flex-shrink-0">
        {CATEGORIES.map(({ label, type }) => {
          const isActive = searchTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => handleCategoryClick(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer flex-shrink-0
                ${isActive
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 검색 결과 */}
      <div className="flex-1 overflow-y-auto relative">

        {/* 재검색 중 상단 shimmer 진행 바 — 기존 결과는 그대로 보이면서 업데이트 중임을 표시 */}
        {showProgressBar && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-100 z-10 overflow-hidden">
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
        {!isSearching && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
            <Map size={40} strokeWidth={1.5} />
            <span className="text-sm">지도를 움직이면 주변 장소가 표시됩니다</span>
          </div>
        )}

        {searchResults.map((result: GooglePlace) => (
          <div
            key={result.place_id}
            onClick={() => setSelectedPlace(result)}
            className="flex gap-3 px-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {/* 썸네일 자리 */}
            <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-300">
              <MapPin size={22} strokeWidth={1.5} />
            </div>

            {/* 텍스트 영역 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm font-semibold truncate max-w-[120px]">{result.name}</strong>
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
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[80%]">
                {result.formatted_address}
              </p>

              {/* 버튼 */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setDetailPlace(result); }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <Info size={11} />
                  자세히
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selectedDate) { alert('날짜를 먼저 선택해주세요!'); return; }
                    addPlaceToDayPlan(selectedDate, result);
                  }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer font-medium"
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
