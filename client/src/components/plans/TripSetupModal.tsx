'use client';
import { useState } from 'react';
import { X, Plane, Hotel, Search, Check, Train } from 'lucide-react';
import usePlanStore, { GooglePlace, TripConfig } from '@/store/usePlanStore';
import Button from '@/components/common/Button';
import { nestApi } from '@/config/api.config';

type Step = 'airport' | 'hotel';
type AirportField = 'airportDepart' | 'airportArrive';

interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  location: { lat: number; lng: number };
  types: string[];
}

interface TripSetupModalProps {
  onClose: () => void;
}

const TripSetupModal = ({ onClose }: TripSetupModalProps) => {
  const setTripConfig  = usePlanStore((s) => s.setTripConfig);
  const applyTripConfig = usePlanStore((s) => s.applyTripConfig);
  const tripConfig     = usePlanStore((s) => s.tripConfig);
  const dayPlans       = usePlanStore((s) => s.dayPlans);

  const isDayTrip = dayPlans.length === 1;

  const [step, setStep] = useState<Step>('airport');
  const [draft, setDraft] = useState<TripConfig>({
    hotel: tripConfig.hotel,
    airportDepart: tripConfig.airportDepart,
    airportArrive: tripConfig.airportArrive,
  });

  // 공항/역·터미널 검색 상태
  const [airportQuery, setAirportQuery] = useState('');
  const [airportResults, setAirportResults] = useState<PlaceSearchResult[]>([]);
  const [isSearchingAirport, setIsSearchingAirport] = useState(false);
  const [activeAirportField, setActiveAirportField] = useState<AirportField>('airportDepart');
  // 검색 타입 — 'airport': 공항 전용, 'transit': 역·터미널 자유 검색
  const [transitType, setTransitType] = useState<'airport' | 'transit'>('airport');

  // 호텔 검색 상태
  const [hotelQuery, setHotelQuery] = useState('');
  const [hotelResults, setHotelResults] = useState<PlaceSearchResult[]>([]);
  const [isSearchingHotel, setIsSearchingHotel] = useState(false);

  const searchPlaces = async (query: string, type: 'airport' | 'transit' | 'hotel') => {
    if (!query.trim()) return;
    if (type !== 'hotel') setIsSearchingAirport(true);
    else setIsSearchingHotel(true);

    try {
      const res = await nestApi.get<{ results: PlaceSearchResult[] }>('/place-search', {
        params: { query, type },
      });
      if (type !== 'hotel') setAirportResults(res.data.results ?? []);
      else setHotelResults(res.data.results ?? []);
    } catch {
      if (type !== 'hotel') setAirportResults([]);
      else setHotelResults([]);
    } finally {
      if (type !== 'hotel') setIsSearchingAirport(false);
      else setIsSearchingHotel(false);
    }
  };

  const toGooglePlace = (p: PlaceSearchResult, slotType: GooglePlace['slotType']): GooglePlace => ({
    place_id: p.place_id,
    name: p.name,
    formatted_address: p.formatted_address,
    location: p.location,
    types: p.types,
    slotType,
  });

  const handleSelectAirport = (place: PlaceSearchResult) => {
    setDraft((prev) => ({
      ...prev,
      [activeAirportField]: toGooglePlace(
        place,
        activeAirportField === 'airportDepart' ? 'airport_depart' : 'airport_arrive',
      ),
    }));
    setAirportResults([]);
    setAirportQuery('');
  };

  const handleSelectHotel = (place: PlaceSearchResult) => {
    setDraft((prev) => ({ ...prev, hotel: toGooglePlace(place, 'hotel') }));
    setHotelResults([]);
    setHotelQuery('');
  };

  const handleConfirm = () => {
    setTripConfig(draft);
    applyTripConfig();
    onClose();
  };

  const labelForField: Record<AirportField, string> = {
    airportDepart: '출발 공항',
    airportArrive: '도착 공항',
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl w-[340px] flex flex-col overflow-hidden">
        {/* 헤더 — 바깥 클릭으로 닫히지 않으므로 X 버튼 없음, 하단 취소 버튼으로만 닫기 */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white/90">여행 기본 설정</h2>
        </div>

        {/* 스텝 탭 */}
        <div className="flex border-b border-gray-100 dark:border-white/8">
          {(['airport', 'hotel'] as Step[]).map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors cursor-pointer
                ${step === s
                  ? 'text-[#2563EB] dark:text-[#60A5FA] border-b-2 border-[#2563EB] dark:border-[#60A5FA]'
                  : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'
                }`}
            >
              {s === 'airport' ? <Plane size={13} /> : <Hotel size={13} />}
              {s === 'airport' ? '공항' : '호텔'}
            </button>
          ))}
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[420px]">
          {step === 'airport' && (
            <>
              <p className="text-xs text-gray-400 dark:text-white/30 leading-relaxed">
                {isDayTrip
                  ? '당일치기 일정의 앞뒤에 출발지·도착지가 배치됩니다.'
                  : '출발지는 첫날 앞, 도착지는 마지막날 뒤에 자동 배치됩니다. 공항·역·터미널 모두 설정 가능합니다.'}
              </p>

              {/* 출발/도착 공항 필드 선택 */}
              <div className="flex gap-2">
                {(['airportDepart', 'airportArrive'] as AirportField[]).map((field) => (
                  <button
                    key={field}
                    onClick={() => setActiveAirportField(field)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border
                      ${activeAirportField === field
                        ? 'bg-[#EFF6FF] dark:bg-[#2563EB]/20 border-[#2563EB] dark:border-[#3B82F6] text-[#2563EB] dark:text-[#60A5FA]'
                        : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/40 hover:border-gray-400'
                      }`}
                  >
                    {labelForField[field]}
                    {draft[field] && (
                      <Check size={11} className="inline ml-1" />
                    )}
                  </button>
                ))}
              </div>

              {/* 공항 vs 역·터미널 토글 */}
              <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                {(['airport', 'transit'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTransitType(t); setAirportResults([]); setAirportQuery(''); }}
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

              {/* 선택된 출발지/도착지 표시 */}
              {draft[activeAirportField] && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFF6FF] dark:bg-[#2563EB]/10 border border-[#DBEAFE] dark:border-[#3B82F6]/30">
                    {draft[activeAirportField]!.types?.some((t) => ['train_station', 'transit_station', 'subway_station', 'bus_station', 'ferry_terminal'].includes(t))
                      ? <Train size={13} className="text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0" />
                      : <Plane size={13} className="text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">{draft[activeAirportField]!.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-white/30 truncate">{draft[activeAirportField]!.formatted_address}</p>
                    </div>
                    <button
                      onClick={() => setDraft((prev) => ({ ...prev, [activeAirportField]: null }))}
                      className="text-gray-300 dark:text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {/* 출발지 선택 후 도착지도 동일하게 채우는 버튼 */}
                  {activeAirportField === 'airportDepart' && !draft.airportArrive && (
                    <button
                      onClick={() => setDraft((prev) => ({
                        ...prev,
                        airportArrive: prev.airportDepart
                          ? { ...prev.airportDepart, slotType: 'airport_arrive' }
                          : null,
                      }))}
                      className="text-xs text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer text-left"
                    >
                      도착지도 동일하게 설정
                    </button>
                  )}
                </div>
              )}

              {/* 출발지/도착지 검색 */}
              <div className="flex gap-2">
                <input
                  value={airportQuery}
                  onChange={(e) => setAirportQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchPlaces(airportQuery, transitType)}
                  placeholder={transitType === 'airport' ? `${labelForField[activeAirportField]} 검색...` : '역명 · 터미널명 검색...'}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2563EB] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#DBEAFE] dark:focus:ring-[#2563EB]/20 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
                />
                <button
                  onClick={() => searchPlaces(airportQuery, transitType)}
                  disabled={isSearchingAirport}
                  className="px-3 py-2 rounded-xl bg-[#2563EB] dark:bg-[#3B82F6] text-white text-sm hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSearchingAirport ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search size={15} />
                  )}
                </button>
              </div>

              {/* 공항 검색 결과 */}
              {airportResults.length > 0 && (
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {airportResults.map((place) => (
                    <button
                      key={place.place_id}
                      onClick={() => handleSelectAirport(place)}
                      className="flex flex-col items-start px-3 py-2.5 rounded-xl hover:bg-[#EFF6FF] dark:hover:bg-white/5 transition-colors cursor-pointer text-left border border-gray-100 dark:border-white/8"
                    >
                      <span className="text-xs font-semibold text-gray-800 dark:text-white/80">{place.name}</span>
                      <span className="text-[10px] text-gray-400 dark:text-white/30 truncate w-full">{place.formatted_address}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 선택 안 함 */}
              <button
                onClick={() => {
                  setDraft((prev) => ({ ...prev, [activeAirportField]: null }));
                  setAirportResults([]);
                  setAirportQuery('');
                }}
                className="text-xs text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors cursor-pointer text-left"
              >
                {labelForField[activeAirportField]} 없음 (선택 안 함)
              </button>
            </>
          )}

          {step === 'hotel' && (
            <>
              <p className="text-xs text-gray-400 dark:text-white/30 leading-relaxed">
                {isDayTrip
                  ? '당일치기는 호텔 설정이 필요하지 않습니다.'
                  : '호텔은 각 날짜의 시작과 끝에 자동 배치됩니다. 날짜별로 변경하려면 일정 패널에서 슬롯을 클릭하세요.'}
              </p>

              {isDayTrip ? null : (
                <>
                  {/* 선택된 호텔 표시 */}
                  {draft.hotel && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFF6FF] dark:bg-[#2563EB]/10 border border-[#DBEAFE] dark:border-[#3B82F6]/30">
                      <Hotel size={13} className="text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">{draft.hotel.name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-white/30 truncate">{draft.hotel.formatted_address}</p>
                      </div>
                      <button
                        onClick={() => setDraft((prev) => ({ ...prev, hotel: null }))}
                        className="text-gray-300 dark:text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* 호텔 검색 */}
                  <div className="flex gap-2">
                    <input
                      value={hotelQuery}
                      onChange={(e) => setHotelQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchPlaces(hotelQuery, 'hotel')}
                      placeholder="호텔명 또는 주소 검색..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2563EB] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#DBEAFE] dark:focus:ring-[#2563EB]/20 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
                    />
                    <button
                      onClick={() => searchPlaces(hotelQuery, 'hotel')}
                      disabled={isSearchingHotel}
                      className="px-3 py-2 rounded-xl bg-[#2563EB] dark:bg-[#3B82F6] text-white text-sm hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSearchingHotel ? (
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Search size={15} />
                      )}
                    </button>
                  </div>

                  {/* 호텔 검색 결과 */}
                  {hotelResults.length > 0 && (
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {hotelResults.map((place) => (
                        <button
                          key={place.place_id}
                          onClick={() => handleSelectHotel(place)}
                          className="flex flex-col items-start px-3 py-2.5 rounded-xl hover:bg-[#EFF6FF] dark:hover:bg-white/5 transition-colors cursor-pointer text-left border border-gray-100 dark:border-white/8"
                        >
                          <span className="text-xs font-semibold text-gray-800 dark:text-white/80">{place.name}</span>
                          <span className="text-[10px] text-gray-400 dark:text-white/30 truncate w-full">{place.formatted_address}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 호텔 없음 */}
                  <button
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, hotel: null }));
                      setHotelResults([]);
                      setHotelQuery('');
                    }}
                    className="text-xs text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors cursor-pointer text-left"
                  >
                    호텔 없음 (선택 안 함)
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 dark:border-white/8">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            건너뛰기
          </Button>
          {step === 'airport' && !isDayTrip ? (
            <Button variant="primary" onClick={() => setStep('hotel')} className="flex-1">
              다음: 호텔
            </Button>
          ) : (
            <Button variant="primary" onClick={handleConfirm} className="flex-1">
              적용
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripSetupModal;
