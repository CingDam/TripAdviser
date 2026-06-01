'use client';
import { useState } from 'react';
import { Search, Plane, Train } from 'lucide-react';
import { nestApi } from '@/config/api.config';
import { PlaceSearchResult } from '@/types/place';

// 공항·호텔·역 검색 공통 UI — input + 검색 버튼 + 결과 리스트
// 공항/역·터미널 토글은 showTransitToggle일 때만 노출 (호텔 검색은 토글 없음)
interface PlaceSearchProps {
  // 'hotel'이면 토글 없이 호텔 검색, 'transit'이면 공항/역·터미널 토글 노출
  mode: 'hotel' | 'transit';
  onSelect: (place: PlaceSearchResult) => void;
  // 결과 리스트 최대 높이 — 모달마다 여백이 달라 호출부에서 지정
  resultMaxHeight?: string;
}

const PlaceSearch = ({ mode, onSelect, resultMaxHeight = 'max-h-40' }: PlaceSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // 공항 vs 역·터미널 — mode가 'transit'일 때만 의미 있음
  const [transitType, setTransitType] = useState<'airport' | 'transit'>('airport');

  // 호텔은 'hotel', 교통은 토글 선택값으로 검색 타입 결정
  const searchType = mode === 'hotel' ? 'hotel' : transitType;

  const searchPlaces = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await nestApi.get<{ results: PlaceSearchResult[] }>('/place-search', {
        params: { query, type: searchType },
      });
      setResults(res.data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const placeholder =
    mode === 'hotel'
      ? '호텔명 또는 주소 검색...'
      : transitType === 'airport'
      ? '공항명 검색...'
      : '역명 · 터미널명 검색...';

  return (
    <>
      {/* 공항 vs 역·터미널 토글 — 교통 모드에서만 */}
      {mode === 'transit' && (
        <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
          {(['airport', 'transit'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTransitType(t); setResults([]); setQuery(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                ${transitType === t
                  ? 'bg-white dark:bg-[#3a3a3c] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'
                }`}
            >
              {t === 'airport' ? <Plane size={12} /> : <Train size={12} />}
              {t === 'airport' ? '공항' : '역 · 터미널'}
            </button>
          ))}
        </div>
      )}

      {/* 검색 입력 */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchPlaces()}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2563EB] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#DBEAFE] dark:focus:ring-[#2563EB]/20 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
        />
        <button
          onClick={searchPlaces}
          disabled={isSearching}
          className="px-3 py-2 rounded-xl bg-[#2563EB] dark:bg-[#3B82F6] text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-50"
        >
          {isSearching ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Search size={15} />
          )}
        </button>
      </div>

      {/* 검색 결과 — 선택 후 리스트만 비움(검색어 유지) */}
      {results.length > 0 && (
        <div className={`flex flex-col gap-1 ${resultMaxHeight} overflow-y-auto`}>
          {results.map((place) => (
            <button
              key={place.place_id}
              onClick={() => { onSelect(place); setResults([]); }}
              className="flex flex-col items-start px-3 py-2.5 rounded-xl hover:bg-[#EFF6FF] dark:hover:bg-white/5 transition-colors cursor-pointer text-left border border-gray-100 dark:border-white/8"
            >
              <span className="text-xs font-semibold text-gray-800 dark:text-white/80">{place.name}</span>
              <span className="text-[10px] text-gray-400 dark:text-white/30 truncate w-full">{place.formatted_address}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default PlaceSearch;
