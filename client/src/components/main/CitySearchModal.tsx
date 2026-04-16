'use client';
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { MapPin, Search, X, Loader2 } from 'lucide-react';
import usePlanStore from '@/store/usePlanStore';

interface PlacePrediction {
  placeId: string;
  structuredFormat: {
    mainText: { text: string };
    secondaryText?: { text: string };
  };
}

interface Suggestion {
  placePrediction: PlacePrediction;
}

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

const CitySearchModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const fullReset = usePlanStore((s) => s.fullReset);

  const fetchSuggestions = async (query: string) => {
    if (!query.trim()) { setSuggestions([]); return; }
    setIsLoading(true);
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          input: query,
          includedPrimaryTypes: ['locality'],
          languageCode: 'ko',
        }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInput = (value: string) => {
    setInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // 입력마다 API 호출 시 Rate Limit 위험 — 300ms 후 마지막 입력만 처리
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    const { placeId, structuredFormat } = suggestion.placePrediction;
    const cityName = structuredFormat.mainText.text;
    setIsNavigating(true);
    // 이전 세션 일정 데이터가 남아있을 수 있으므로 이동 전 스토어 초기화
    fullReset();

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}?fields=location`,
        { headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY } },
      );
      const data = await res.json();
      const { latitude: lat, longitude: lng } = data.location;
      router.push(`/plan?q=${encodeURIComponent(cityName)}&lat=${lat}&lng=${lng}`);
    } catch {
      // 위치 조회 실패 시 도시명만 전달 — plan 페이지 검색으로 위치 보정
      router.push(`/plan?q=${encodeURIComponent(cityName)}`);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setInput('');
    setSuggestions([]);
    setIsNavigating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-95 transition-all shadow-xl shadow-gray-900/15 dark:shadow-black/40 cursor-pointer"
      >
        <MapPin size={16} />
        지금 일정 만들기
      </button>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-white/30 dark:bg-black/40 backdrop-blur-xl"
          onClick={handleClose}
          onKeyDown={handleKeyDown}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/8">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">어디로 떠나시나요?</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/70 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* 검색 입력 */}
            <div className="p-4">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30 transition-all">
                <Search size={16} className="text-gray-400 dark:text-white/30 flex-shrink-0" />
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => handleInput(e.target.value)}
                  placeholder="도시 이름을 입력하세요 (예: 도쿄, 파리)"
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 outline-none"
                />
                {isLoading && (
                  <Loader2 size={14} className="animate-spin text-gray-400 dark:text-white/30 flex-shrink-0" />
                )}
              </div>
            </div>

            {/* 자동완성 목록 */}
            {suggestions.length > 0 && (
              <ul className="pb-2 max-h-64 overflow-y-auto">
                {suggestions.map((s) => (
                  <li key={s.placePrediction.placeId}>
                    <button
                      onClick={() => handleSelect(s)}
                      disabled={isNavigating}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left cursor-pointer disabled:opacity-50"
                    >
                      <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <MapPin size={13} className="text-indigo-400" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white/90">
                          {s.placePrediction.structuredFormat.mainText.text}
                        </div>
                        {s.placePrediction.structuredFormat.secondaryText && (
                          <div className="text-xs text-gray-400 dark:text-white/30">
                            {s.placePrediction.structuredFormat.secondaryText.text}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* 입력했으나 결과 없을 때 */}
            {input.trim() && !isLoading && suggestions.length === 0 && (
              <p className="px-5 pb-5 text-sm text-gray-400 dark:text-white/30 text-center">
                검색 결과가 없어요
              </p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default CitySearchModal;
