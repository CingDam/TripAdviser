import { create } from "zustand";
import { SearchType } from "@/hook/usePlaceSearch";

export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  location: {
    lat: number;
    lng: number;
  };
  types: string[];
  rating?: number | null;
  user_ratings_total?: number | null;
  icon?: string;
  openNow?: boolean | null;
  // weekdayDescriptions: ["월요일: 오전 9:00 ~ 오후 10:00", ...] 형태의 배열
  weekdayDescriptions?: string[] | null;
  phone?: string | null;
  website?: string | null;
  photoUrl?: string | null;
  // AI 자동정렬이 부여한 시간대 레이블 — '오전·점심·오후·저녁·야간' 중 하나
  timeSlot?: string | null;
  // Google Places priceLevel — 0(무료)~4(매우 비쌈), null이면 가격 정보 없음
  priceLevel?: number | null;
  // 자동배치 슬롯 구분 — 일반 장소와 분리해 항상 첫/마지막에 고정
  slotType?: 'hotel' | 'airport_depart' | 'airport_arrive' | null;
}

export interface DayPlan {
  date: string; // "2024-01-01"
  places: GooglePlace[];
}

// GET /api/plan/:id 응답의 dayPlans 항목 형태 — 저장된 데이터 로드 시 사용
export interface SavedDayPlanItem {
  placeId: string | null;
  locationName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  planDate: string;
  sortOrder: number;
}

// 여행 설정 — 날짜 범위 확정 후 공항/호텔 선택에 사용
export interface TripConfig {
  hotel: GooglePlace | null;
  airportDepart: GooglePlace | null; // 출발 공항 (첫날 앞에 배치)
  airportArrive: GooglePlace | null; // 도착 공항 (마지막날 뒤에 배치)
}

interface PlanState {
  searchParams: string;
  setSearchParams: (value: string) => void;
  searchResults: GooglePlace[];
  setSearchResults: (value: GooglePlace[]) => void;
  appendSearchResults: (value: GooglePlace[]) => void;
  isSearching: boolean;
  setIsSearching: (value: boolean) => void;
  // 스크롤 끝 도달 시 추가 로드 가능 여부
  hasMore: boolean;
  setHasMore: (value: boolean) => void;
  // 추가 로드 중 스피너 표시용
  isLoadingMore: boolean;
  setIsLoadingMore: (value: boolean) => void;
  // SearchContainer가 스크롤 끝에 닿으면 증가 → MapHandler가 감지해 loadMore 실행
  loadMoreTrigger: number;
  incrementLoadMoreTrigger: () => void;
  currentLatLng: { lat: number; lng: number } | null;
  setCurrentLatLng: (value: { lat: number; lng: number }) => void;
  selectedPlace: GooglePlace | null;
  setSelectedPlace: (value: GooglePlace | null) => void;
  detailPlace: GooglePlace | null;
  setDetailPlace: (value: GooglePlace | null) => void;

  dayPlans: DayPlan[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  addDayPlan: (date: string) => void;
  removeDayPlan: (date: string) => void;
  addPlaceToDayPlan: (date: string, place: GooglePlace) => void;
  removePlaceFromDayPlan: (date: string, place_id: string) => void;
  // 카테고리 필터: 선택된 타입 목록 (빈 배열 = 전체)
  searchTypes: SearchType[];
  setSearchTypes: (types: SearchType[]) => void;
  // MapHandler가 감지해서 재검색을 트리거하는 카운터
  searchTrigger: number;
  incrementSearchTrigger: () => void;
  // 지도 이동 후 "이 지역 검색" 버튼 표시 여부
  showAreaSearch: boolean;
  setShowAreaSearch: (value: boolean) => void;

  clearDayPlans: () => void;
  resetDayPlans: (dates: string[]) => void;
  reorderDayPlan: (date: string, places: GooglePlace[]) => void;
  // 플랜 페이지 이탈 확인 모달 표시 여부 — Header·layout 간 공유
  showExitGuard: boolean;
  setShowExitGuard: (visible: boolean) => void;
  // 이탈 확정 시 플랜 전체 초기화 — Calendar 로컬 상태 리셋용 카운터 포함
  calendarResetKey: number;
  fullReset: () => void;

  // 기존 일정 수정 시 설정 — null이면 신규 생성, 숫자면 PUT /api/plan/:id/full 호출
  currentPlanNum: number | null;
  currentPlanName: string | null;
  currentIsPublic: boolean;
  // 수정 모드에서 SavePlanModal 도시 드롭다운 초기값으로 사용
  currentCityNum: number | null;
  // 수정 모드에서 Calendar range 복원에 사용 — items의 planDate 범위에서 파생
  currentStartDate: string | null;
  currentEndDate: string | null;
  // 저장된 일정 데이터를 에디터에 로드 — SavedDayPlanItem[]을 DayPlan[]으로 변환
  loadPlanData: (planNum: number, planName: string, isPublic: boolean, items: SavedDayPlanItem[], cityNum?: number | null) => void;

  // 여행 공항/호텔 설정
  tripConfig: TripConfig;
  setTripConfig: (config: TripConfig) => void;
  // tripConfig를 기반으로 dayPlans 각 날짜에 슬롯 자동배치
  applyTripConfig: () => void;
}

const usePlanStore = create<PlanState>((set) => ({
  searchParams: "",
  setSearchParams: (value) => set({ searchParams: value }),
  searchResults: [],
  setSearchResults: (value) => set({ searchResults: value }),
  appendSearchResults: (value) => set((state) => ({
    searchResults: [...state.searchResults, ...value],
  })),
  isSearching: false,
  setIsSearching: (value) => set({ isSearching: value }),
  hasMore: false,
  setHasMore: (value) => set({ hasMore: value }),
  isLoadingMore: false,
  setIsLoadingMore: (value) => set({ isLoadingMore: value }),
  loadMoreTrigger: 0,
  incrementLoadMoreTrigger: () => set((state) => ({ loadMoreTrigger: state.loadMoreTrigger + 1 })),
  currentLatLng: null,
  setCurrentLatLng: (value) => set({ currentLatLng: value }),
  selectedPlace: null,
  setSelectedPlace: (value) => set({ selectedPlace: value }),
  detailPlace: null,
  // 같은 place_id면 이미 조회한 상세 필드(영업시간·전화·웹사이트·사진)를 유지 — 재클릭 시 깜빡임 방지
  setDetailPlace: (value) => set((state) => {
    if (!value) return { detailPlace: null };
    if (state.detailPlace?.place_id === value.place_id && state.detailPlace.weekdayDescriptions !== undefined) {
      return { detailPlace: { ...value, weekdayDescriptions: state.detailPlace.weekdayDescriptions, phone: state.detailPlace.phone, website: state.detailPlace.website, photoUrl: state.detailPlace.photoUrl, openNow: state.detailPlace.openNow } };
    }
    return { detailPlace: value };
  }),

  searchTypes: [],
  setSearchTypes: (types) => set({ searchTypes: types }),
  searchTrigger: 0,
  incrementSearchTrigger: () => set((state) => ({ searchTrigger: state.searchTrigger + 1 })),
  showAreaSearch: false,
  setShowAreaSearch: (value) => set({ showAreaSearch: value }),

  dayPlans: [],
  selectedDate: "",
  setSelectedDate: (date) => set({ selectedDate: date }),
  addDayPlan: (date) => set((state) => {
    const exists = state.dayPlans.some((d) => d.date === date);
    if (exists) return state;
    return { dayPlans: [...state.dayPlans, { date, places: [] }] };
  }),
  removeDayPlan: (date) => set((state) => ({
    dayPlans: state.dayPlans.filter((d) => d.date !== date)
  })),
  addPlaceToDayPlan: (date, place) => set((state) => ({
    dayPlans: state.dayPlans.map((d) => {
      if (d.date !== date) return d;
      if (d.places.some((p) => p.place_id === place.place_id)) return d;

      // after 슬롯(호텔 체크인·도착공항) 직전에 삽입 — 일반 장소가 슬롯 사이에 위치하도록
      // 마지막 일반 장소 인덱스를 구한 뒤, 그 다음에 오는 첫 슬롯 위치가 삽입 지점
      const lastNormalIdx = d.places.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1);
      const afterSlotStart = d.places.findIndex(
        (p, i) => !!p.slotType && (lastNormalIdx === undefined || i > lastNormalIdx),
      );
      const spliceIdx = afterSlotStart === -1 ? d.places.length : afterSlotStart;
      const next = [...d.places];
      next.splice(spliceIdx, 0, place);
      return { ...d, places: next };
    })
  })),
  removePlaceFromDayPlan: (date, place_id) => set((state) => ({
    dayPlans: state.dayPlans.map((d) =>
      d.date === date
        ? { ...d, places: d.places.filter((p) => p.place_id !== place_id) }
        : d
    )
  })),
  clearDayPlans: () => set((state) => ({
    dayPlans: state.dayPlans.map((d) => ({ ...d, places: [] })),
    selectedDate: state.selectedDate,
  })),
  resetDayPlans: (dates) => set({
    dayPlans: dates.map((date) => ({ date, places: [] })),
  }),
  reorderDayPlan: (date, places) => set((state) => ({
    dayPlans: state.dayPlans.map((d) =>
      d.date === date ? { ...d, places } : d
    ),
  })),
  showExitGuard: false,
  setShowExitGuard: (visible) => set({ showExitGuard: visible }),
  calendarResetKey: 0,
  // 이탈 시 검색·일정 상태 전체 초기화 — calendarResetKey 증가로 Calendar 로컬 상태도 리셋
  fullReset: () => set((state) => ({
    dayPlans: [],
    selectedDate: '',
    searchResults: [],
    searchParams: '',
    searchTypes: [],
    showAreaSearch: false,
    hasMore: false,
    isLoadingMore: false,
    loadMoreTrigger: 0,
    selectedPlace: null,
    detailPlace: null,
    showExitGuard: false,
    calendarResetKey: state.calendarResetKey + 1,
    currentPlanNum: null,
    currentPlanName: null,
    currentIsPublic: false,
    currentCityNum: null,
    currentStartDate: null,
    currentEndDate: null,
    tripConfig: { hotel: null, airportDepart: null, airportArrive: null },
  })),

  currentPlanNum: null,
  currentPlanName: null,
  currentIsPublic: false,
  currentCityNum: null,
  currentStartDate: null,
  currentEndDate: null,

  tripConfig: { hotel: null, airportDepart: null, airportArrive: null },
  setTripConfig: (config) => set({ tripConfig: config }),
  applyTripConfig: () => set((state) => {
    const { hotel, airportDepart, airportArrive } = state.tripConfig;
    const days = state.dayPlans;
    if (days.length === 0) return state;

    const isDayTrip = days.length === 1;

    return {
      dayPlans: days.map((day, i) => {
        const isFirst = i === 0;
        const isLast  = i === days.length - 1;

        // 슬롯이 아닌 일반 장소만 유지 — 재적용 시 기존 슬롯 제거
        const normalPlaces = day.places.filter((p) => !p.slotType);

        const before: GooglePlace[] = [];
        const after: GooglePlace[]  = [];

        if (isDayTrip) {
          // 당일치기: 출발 공항 → 관광 → 도착 공항
          if (airportDepart) before.push({ ...airportDepart, slotType: 'airport_depart' });
          if (airportArrive) after.push({ ...airportArrive, slotType: 'airport_arrive' });
        } else {
          if (isFirst) {
            // 첫날: 출발 공항 → 도착 공항 → 관광 → 호텔 체크인
            if (airportDepart) before.push({ ...airportDepart, slotType: 'airport_depart' });
            if (airportArrive) before.push({ ...airportArrive, slotType: 'airport_arrive' });
            if (hotel)         after.push({ ...hotel, slotType: 'hotel' });
          } else if (isLast) {
            // 마지막날: 호텔 체크아웃 → 관광 → 귀국 공항
            if (hotel)         before.push({ ...hotel, slotType: 'hotel' });
            if (airportArrive) after.push({ ...airportArrive, slotType: 'airport_arrive' });
          } else {
            // 중간날: 호텔 → 관광 → 호텔
            if (hotel) {
              before.push({ ...hotel, slotType: 'hotel' });
              after.push({ ...hotel, slotType: 'hotel' });
            }
          }
        }

        return { ...day, places: [...before, ...normalPlaces, ...after] };
      }),
    };
  }),

  // 저장된 dayPlans 데이터를 에디터 형식으로 변환해 스토어에 적재
  loadPlanData: (planNum, planName, isPublic, items, cityNum) => {
    // planDate · sortOrder 기준 정렬 후 날짜별 그룹핑
    const sorted = [...items]
      .filter((i) => i.placeId !== null)
      .sort((a, b) => {
        if (a.planDate !== b.planDate) return a.planDate.localeCompare(b.planDate);
        return a.sortOrder - b.sortOrder;
      });

    const map = new Map<string, GooglePlace[]>();
    for (const item of sorted) {
      if (!map.has(item.planDate)) map.set(item.planDate, []);
      // GooglePlace 부분 복원 — types·rating 등 저장 안 된 필드는 기본값
      map.get(item.planDate)!.push({
        place_id: item.placeId!,
        name: item.locationName ?? '',
        formatted_address: item.address ?? '',
        location: { lat: item.lat ?? 0, lng: item.lng ?? 0 },
        types: [],
        rating: null,
      });
    }

    const dayPlans = Array.from(map.entries()).map(([date, places]) => ({ date, places }));

    // 저장된 dayPlan 항목의 planDate 전체에서 범위를 파생 — placeId 필터 전 원본 사용
    const allDates = [...new Set(items.map((i) => i.planDate))].sort();
    const startDate = allDates[0] ?? null;
    const endDate   = allDates[allDates.length - 1] ?? null;

    set({
      currentPlanNum: planNum,
      currentPlanName: planName,
      currentIsPublic: isPublic,
      currentCityNum: cityNum ?? null,
      currentStartDate: startDate,
      currentEndDate: endDate,
      dayPlans,
      selectedDate: dayPlans[0]?.date ?? '',
    });
  },
}));

export default usePlanStore;