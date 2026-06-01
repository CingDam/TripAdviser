'use client';
import { useState } from 'react';
import { X, Plane, Hotel, Train } from 'lucide-react';
import usePlanStore, { GooglePlace, TripConfig } from '@/store/usePlanStore';
import Button from '@/components/common/Button';
import PlaceSearch from './PlaceSearch';
import { PlaceSearchResult, TRANSIT_TYPES } from '@/types/place';

type Step = 'airport' | 'hotel';
// 왕복: 출발=도착 동일 공항 / 편도: 출발·도착 따로 지정
type TripMode = 'roundtrip' | 'oneway';
type AirportField = 'airportDepart' | 'airportArrive';

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

  // 출발·도착이 다르게 잡혀 있으면 편도, 아니면 왕복으로 초기화
  const initialMode: TripMode =
    tripConfig.airportArrive && tripConfig.airportArrive.place_id !== tripConfig.airportDepart?.place_id
      ? 'oneway' : 'roundtrip';
  const [tripMode, setTripMode] = useState<TripMode>(initialMode);

  // 편도 모드에서 지금 검색 중인 끝점 (왕복은 항상 양쪽 동시 적용)
  const [activeField, setActiveField] = useState<AirportField>('airportDepart');

  const toGooglePlace = (p: PlaceSearchResult, slotType: GooglePlace['slotType']): GooglePlace => ({
    place_id: p.place_id,
    name: p.name,
    formatted_address: p.formatted_address,
    location: p.location,
    types: p.types,
    slotType,
  });

  const handleSelectAirport = (place: PlaceSearchResult) => {
    setDraft((prev) => {
      if (tripMode === 'roundtrip') {
        // 왕복 — 한 번 선택으로 출발·도착 모두 채움
        return {
          ...prev,
          airportDepart: toGooglePlace(place, 'airport_depart'),
          airportArrive: toGooglePlace(place, 'airport_arrive'),
        };
      }
      // 편도 — 현재 활성 끝점만 채움
      return {
        ...prev,
        [activeField]: toGooglePlace(
          place,
          activeField === 'airportDepart' ? 'airport_depart' : 'airport_arrive',
        ),
      };
    });
  };

  const handleSelectHotel = (place: PlaceSearchResult) => {
    setDraft((prev) => ({ ...prev, hotel: toGooglePlace(place, 'hotel') }));
  };

  const handleConfirm = () => {
    setTripConfig(draft);
    applyTripConfig();
    onClose();
  };

  const switchMode = (mode: TripMode) => {
    setTripMode(mode);
    if (mode === 'roundtrip') {
      // 왕복으로 전환 — 출발 공항을 도착에도 복사
      setDraft((prev) => ({
        ...prev,
        airportArrive: prev.airportDepart
          ? { ...prev.airportDepart, slotType: 'airport_arrive' }
          : prev.airportArrive,
      }));
    }
    setActiveField('airportDepart');
  };

  const isTransit = (place: GooglePlace) => place.types?.some((t) => TRANSIT_TYPES.includes(t));

  // 선택된 공항 칩 — 편도는 라벨 표시, 왕복은 단일 칩
  const renderChip = (place: GooglePlace, label: string, onRemove: () => void) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFF6FF] dark:bg-[#2563EB]/10 border border-[#DBEAFE] dark:border-[#3B82F6]/30">
      {isTransit(place)
        ? <Train size={13} className="text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0" />
        : <Plane size={13} className="text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[#2563EB] dark:text-[#60A5FA] font-semibold">{label}</p>
        <p className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">{place.name}</p>
        <p className="text-[10px] text-gray-400 dark:text-white/30 truncate">{place.formatted_address}</p>
      </div>
      <button
        onClick={onRemove}
        className="text-gray-300 dark:text-white/20 hover:text-red-400 transition-colors cursor-pointer"
      >
        <X size={12} />
      </button>
    </div>
  );

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl w-[340px] flex flex-col overflow-hidden">
        {/* 헤더 — 바깥 클릭으로 닫히지 않으므로 X 버튼 없음, 하단 취소 버튼으로만 닫기 */}
        {/* 날짜 직후 자동 진입을 고려해 '왜 떴는지 + 선택사항'임을 함께 안내 */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white/90">교통편 · 숙소 먼저 정하기</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-1 leading-relaxed">
            공항·역과 호텔을 먼저 정하면 일정 앞뒤에 자동 배치돼 동선이 깔끔해져요. 나중에 정해도 괜찮아요.
          </p>
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

        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[440px]">
          {step === 'airport' && (
            <>
              {/* 왕복 / 편도 모드 — 가장 흔한 왕복을 기본값으로 */}
              <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                {([['roundtrip', '왕복 (같은 공항)'], ['oneway', '편도 (다른 공항)']] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => switchMode(mode)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                      ${tripMode === mode
                        ? 'bg-white dark:bg-[#3a3a3c] text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-400 dark:text-white/30 leading-relaxed">
                {tripMode === 'roundtrip'
                  ? '한 번만 검색하면 출발·도착에 같은 공항이 적용됩니다. 공항·역·터미널 모두 가능합니다.'
                  : '출발지와 도착지를 각각 선택하세요.'}
              </p>

              {/* 편도 — 출발/도착 끝점 선택 */}
              {tripMode === 'oneway' && (
                <div className="flex gap-2">
                  {([['airportDepart', '출발지'], ['airportArrive', '도착지']] as const).map(([field, label]) => (
                    <button
                      key={field}
                      onClick={() => setActiveField(field)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border
                        ${activeField === field
                          ? 'bg-[#EFF6FF] dark:bg-[#2563EB]/20 border-[#2563EB] dark:border-[#3B82F6] text-[#2563EB] dark:text-[#60A5FA]'
                          : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/40 hover:border-gray-400'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* 선택된 출발지/도착지 표시 */}
              {tripMode === 'roundtrip'
                ? draft.airportDepart && renderChip(draft.airportDepart, '출발 · 도착 (왕복)',
                    () => setDraft((prev) => ({ ...prev, airportDepart: null, airportArrive: null })))
                : (
                  <div className="flex flex-col gap-1.5">
                    {draft.airportDepart && renderChip(draft.airportDepart, '출발지',
                      () => setDraft((prev) => ({ ...prev, airportDepart: null })))}
                    {draft.airportArrive && renderChip(draft.airportArrive, '도착지',
                      () => setDraft((prev) => ({ ...prev, airportArrive: null })))}
                  </div>
                )}

              {/* 검색 — 공항/역·터미널 토글 포함. activeField 전환 시 리마운트해 내부 검색어 초기화 */}
              <PlaceSearch
                key={tripMode === 'oneway' ? activeField : 'roundtrip'}
                mode="transit"
                onSelect={handleSelectAirport}
              />
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

                  {/* 호텔 검색 — 토글 없음 */}
                  <PlaceSearch mode="hotel" onSelect={handleSelectHotel} />
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
