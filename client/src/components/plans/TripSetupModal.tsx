'use client';
import { useState } from 'react';
import { X, Plane, Hotel, Train } from 'lucide-react';
import usePlanStore, { GooglePlace, TripConfig } from '@/store/usePlanStore';
import Button from '@/components/common/Button';
import PlaceSearch from './PlaceSearch';
import TimeField from './TimeField';
import { PlaceSearchResult, TRANSIT_TYPES } from '@/types/place';

type Step = 'airport' | 'hotel';
// 출발지(집 공항)·도착지(현지 공항)를 각각 지정 — 시스템이 가는편·오는편을 자동 배치
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
    arrivalTime: tripConfig.arrivalTime,
    departureTime: tripConfig.departureTime,
  });

  // 지금 검색 중인 끝점 — 출발지(집)와 도착지(현지)를 번갈아 선택
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
    // 현재 활성 끝점만 채움 — 출발지 선택 후 도착지로 자동 전환
    setDraft((prev) => ({
      ...prev,
      [activeField]: toGooglePlace(
        place,
        activeField === 'airportDepart' ? 'airport_depart' : 'airport_arrive',
      ),
    }));
    // 출발지를 막 골랐으면 도착지 입력으로 넘겨 흐름을 매끄럽게
    if (activeField === 'airportDepart') setActiveField('airportArrive');
  };

  const handleSelectHotel = (place: PlaceSearchResult) => {
    setDraft((prev) => ({ ...prev, hotel: toGooglePlace(place, 'hotel') }));
  };

  const handleConfirm = () => {
    setTripConfig(draft);
    applyTripConfig();
    onClose();
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
              <p className="text-xs text-gray-400 dark:text-white/30 leading-relaxed">
                출발지(집)와 도착지(여행지)를 고르면 가는 편·오는 편에 자동으로 배치돼요. 공항·역·터미널 모두 가능합니다.
              </p>

              {/* 출발/도착 끝점 선택 — 탭으로 지금 검색할 끝점 전환 */}
              <div className="flex gap-2">
                {([['airportDepart', '출발지 (집)'], ['airportArrive', '도착지 (여행지)']] as const).map(([field, label]) => (
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

              {/* 선택된 출발지/도착지 표시 */}
              <div className="flex flex-col gap-1.5">
                {draft.airportDepart && renderChip(draft.airportDepart, '출발지 (집)',
                  () => setDraft((prev) => ({ ...prev, airportDepart: null })))}
                {draft.airportArrive && renderChip(draft.airportArrive, '도착지 (여행지)',
                  () => setDraft((prev) => ({ ...prev, airportArrive: null })))}
              </div>

              {/* 검색 — activeField 전환 시 리마운트해 내부 검색어 초기화 */}
              <PlaceSearch
                key={activeField}
                mode="transit"
                onSelect={handleSelectAirport}
                resultMaxHeight="max-h-72"
              />

              {/* 항공편 시각 (선택) — 첫날·마지막날 가용시간 판단용. 자동생성 시 장소 수 차등에 사용 */}
              {!isDayTrip && (
                <div className="flex flex-col gap-2 pt-1 border-t border-gray-100 dark:border-white/8">
                  <p className="text-[10px] text-gray-400 dark:text-white/30 leading-relaxed">
                    항공편 시각을 넣으면 첫날·마지막날을 반나절로 알아서 채워요. (선택)
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <TimeField
                        label="현지 도착 (첫날)"
                        value={draft.arrivalTime ?? null}
                        onChange={(v) => setDraft((prev) => ({ ...prev, arrivalTime: v }))}
                      />
                    </div>
                    <div className="flex-1">
                      <TimeField
                        label="출국 (마지막날)"
                        value={draft.departureTime ?? null}
                        onChange={(v) => setDraft((prev) => ({ ...prev, departureTime: v }))}
                      />
                    </div>
                  </div>
                </div>
              )}
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
                  <PlaceSearch mode="hotel" onSelect={handleSelectHotel} resultMaxHeight="max-h-72" />
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
