'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, Globe, Lock, MapPin, PenLine, LogIn, Search, Check, ChevronDown } from 'lucide-react';
import Button from '@/components/common/Button';
import { nestApi } from '@/config/api.config';
import usePlanStore, { DayPlan } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import { useAuthStore } from '@/store/useAuthStore';

interface CityOption {
  cityNum: number;
  cityName: string;
  country: string;
}

interface SavePlanModalProps {
  onClose: () => void;
  onSaved: () => void;
}

// Zustand DayPlan 배열을 서버 SavePlanDto.dayPlans 형태로 변환
function buildDayPlanItems(dayPlans: DayPlan[]) {
  return dayPlans.flatMap((day) =>
    day.places.map((place, index) => ({
      planDate: day.date,
      sortOrder: index,
      placeId: place.place_id,
      // DB varchar(50) 제한 — 초과 시 잘라냄
      locationName: place.name.slice(0, 50),
      // DB varchar(100) 제한
      address: place.formatted_address?.slice(0, 100) ?? null,
      lat: place.location.lat,
      lng: place.location.lng,
      // DB varchar(20) 제한
      tel: place.phone?.slice(0, 20) ?? null,
    })),
  );
}

const SavePlanModal = ({ onClose, onSaved }: SavePlanModalProps) => {
  const dayPlans        = usePlanStore((s) => s.dayPlans);
  const currentPlanNum  = usePlanStore((s) => s.currentPlanNum);
  const currentPlanName = usePlanStore((s) => s.currentPlanName);
  const currentIsPublic = usePlanStore((s) => s.currentIsPublic);
  const currentCityNum  = usePlanStore((s) => s.currentCityNum);
  // 직접 입력한 도시의 좌표로 사용 — 사용자가 지도에서 탐색 중인 위치
  const currentLatLng   = usePlanStore((s) => s.currentLatLng);
  const { show } = useSnackbar();
  const token  = useAuthStore((s) => s.token);
  const router = useRouter();

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const isEditMode = currentPlanNum !== null;
  const [planName, setPlanName]   = useState(currentPlanName ?? '');
  const [isPublic, setIsPublic]   = useState(currentIsPublic);
  // 수정 모드에서 기존 도시 값으로 초기화 — null이면 "선택 안 함"
  const [cityNum, setCityNum]     = useState<number | null>(currentCityNum);
  const [cities, setCities]       = useState<CityOption[]>([]);
  // 직접 입력 모드 — DB에 없는 도시를 새로 등록할 때 사용
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [customCityName, setCustomCityName] = useState('');
  const [customCountry, setCustomCountry]   = useState('');
  const [isSaving, setIsSaving]   = useState(false);
  // 도시 드롭다운 — 검색으로 필터링하는 커스텀 셀렉트 (native select는 목록이 길면 보기 불편)
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // 도시 목록 로드
  useEffect(() => {
    nestApi.get<CityOption[]>('/city').then((res) => setCities(res.data)).catch(() => {});
  }, []);

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    if (!cityDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [cityDropdownOpen]);

  // 검색어로 필터링된 도시 목록
  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) => c.cityName.toLowerCase().includes(q) || c.country.toLowerCase().includes(q),
    );
  }, [cities, citySearch]);

  const selectedCity = cities.find((c) => c.cityNum === cityNum) ?? null;

  // 모드 전환 시 기존 선택값 초기화
  const handleToggleCustomCity = () => {
    setIsCustomCity((v) => !v);
    setCityNum(null);
    setCustomCityName('');
    setCustomCountry('');
  };

  const sortedDates = dayPlans.map((d) => d.date).sort();
  const startDate   = sortedDates[0];
  const endDate     = sortedDates[sortedDates.length - 1];

  const handleSave = async () => {
    if (!token) {
      setShowLoginPrompt(true);
      return;
    }
    if (!planName.trim()) {
      show('일정 이름을 입력해주세요', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const cityPayload = isCustomCity
        ? (customCityName.trim() && customCountry.trim()
            ? {
                cityName: customCityName.trim().slice(0, 50),
                country: customCountry.trim().slice(0, 50),
                // 현재 맵 중심 좌표를 도시 좌표로 사용
                ...(currentLatLng && { cityLat: currentLatLng.lat, cityLng: currentLatLng.lng }),
              }
            : {})
        : (cityNum !== null ? { cityNum } : {});

      const body = {
        planName: planName.trim(),
        startDate,
        endDate,
        isPublic,
        ...cityPayload,
        dayPlans: buildDayPlanItems(dayPlans),
      };

      if (isEditMode) {
        await nestApi.put(`/plan/${currentPlanNum}/full`, body);
        show('일정이 수정되었습니다!', 'success');
      } else {
        await nestApi.post('/plan/full', body);
        show('일정이 저장되었습니다!', 'success');
      }
      onSaved();
    } catch {
      show(`${isEditMode ? '수정' : '저장'}에 실패했습니다. 다시 시도해주세요.`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 슬롯(호텔·공항)은 장소 수에서 제외 — 사용자가 직접 추가한 관광지 수만 표시
  const totalPlaces = dayPlans.reduce((acc, d) => acc + d.places.filter((p) => !p.slotType).length, 0);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#2c2c2e] rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 로그인 안내 화면 */}
        {showLoginPrompt ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white/90">로그인 필요</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                <LogIn size={22} className="text-rose-500 dark:text-rose-400" />
              </div>
              <p className="text-sm text-center text-gray-600 dark:text-white/60 leading-relaxed">
                일정을 저장하려면 로그인이 필요합니다.<br />
                로그인 페이지로 이동할까요?
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} className="flex-1">
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => router.push('/login')}
                className="flex-1 flex items-center justify-center gap-1.5"
              >
                <LogIn size={14} />
                로그인하기
              </Button>
            </div>
          </>
        ) : (
          <>
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white/90">
            {isEditMode ? '일정 수정' : '일정 저장'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 요약 */}
        <div className="text-xs text-gray-400 dark:text-white/30">
          {dayPlans.length}일 · 장소 {totalPlaces}개
          {startDate && (
            <span className="ml-1">· {startDate} ~ {endDate}</span>
          )}
        </div>

        {/* 이름 입력 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 dark:text-white/50">
            일정 이름
          </label>
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="예: 도쿄 3박 4일 여행"
            maxLength={45}
            autoFocus
            className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/30 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
          />
        </div>

        {/* 도시 선택 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-600 dark:text-white/50 flex items-center gap-1">
              <MapPin size={11} />
              도시 <span className="font-normal text-gray-400 dark:text-white/25">(선택)</span>
            </label>
            {/* 직접 입력 토글 */}
            <button
              onClick={handleToggleCustomCity}
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg transition-colors cursor-pointer
                ${isCustomCity
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400'
                  : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'
                }`}
            >
              <PenLine size={10} />
              직접 입력
            </button>
          </div>

          {isCustomCity ? (
            /* 직접 입력 — DB에 없는 도시 등록 */
            <div className="flex flex-col gap-2">
              <input
                value={customCityName}
                onChange={(e) => setCustomCityName(e.target.value)}
                placeholder="도시명 (예: 나고야)"
                maxLength={50}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/30 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
              />
              <input
                value={customCountry}
                onChange={(e) => setCustomCountry(e.target.value)}
                placeholder="국가명 (예: 일본)"
                maxLength={50}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/30 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25"
              />
            </div>
          ) : (
            /* 기존 도시 선택 — 검색 가능한 커스텀 드롭다운 */
            <div ref={cityDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setCityDropdownOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/30 transition-all bg-white dark:bg-[#1c1c1e] cursor-pointer"
              >
                <span className={selectedCity ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-white/30'}>
                  {selectedCity ? `${selectedCity.cityName} · ${selectedCity.country}` : '선택 안 함'}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-gray-400 dark:text-white/30 transition-transform ${cityDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {cityDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
                  {/* 검색 입력 */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-white/8">
                    <Search size={13} className="text-gray-400 dark:text-white/30 flex-shrink-0" />
                    <input
                      autoFocus
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      placeholder="도시·국가 검색"
                      className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 outline-none"
                    />
                  </div>

                  {/* 옵션 목록 */}
                  <ul className="max-h-52 overflow-y-auto py-1">
                    {/* 선택 안 함 */}
                    <li>
                      <button
                        type="button"
                        onClick={() => { setCityNum(null); setCityDropdownOpen(false); setCitySearch(''); }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-500 dark:text-white/40 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        선택 안 함
                        {cityNum === null && <Check size={14} className="text-rose-500" />}
                      </button>
                    </li>
                    {filteredCities.map((city) => (
                      <li key={city.cityNum}>
                        <button
                          type="button"
                          onClick={() => { setCityNum(city.cityNum); setCityDropdownOpen(false); setCitySearch(''); }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-900 dark:text-white/90 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
                        >
                          <span className="truncate">
                            {city.cityName} <span className="text-gray-400 dark:text-white/30">· {city.country}</span>
                          </span>
                          {cityNum === city.cityNum && <Check size={14} className="text-rose-500 flex-shrink-0" />}
                        </button>
                      </li>
                    ))}
                    {filteredCities.length === 0 && (
                      <li className="px-3 py-3 text-sm text-center text-gray-400 dark:text-white/30">
                        검색 결과가 없습니다
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 공개 여부 토글 */}
        <button
          onClick={() => setIsPublic((v) => !v)}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-sm
            ${isPublic
              ? 'border-rose-300 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
              : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-500 dark:text-white/40'
            }`}
        >
          {isPublic ? <Globe size={15} /> : <Lock size={15} />}
          <span className="font-medium">{isPublic ? '공개' : '비공개'}</span>
          <span className="ml-auto text-xs opacity-60">
            {isPublic ? '커뮤니티에 공유됩니다' : '나만 볼 수 있습니다'}
          </span>
        </button>

        {/* 버튼 */}
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isSaving ? (isEditMode ? '수정 중...' : '저장 중...') : (isEditMode ? '수정 완료' : '저장')}
          </Button>
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SavePlanModal;
