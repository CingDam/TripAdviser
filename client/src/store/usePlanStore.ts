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

interface PlanState {
  searchParams: string;
  setSearchParams: (value: string) => void;
  searchResults: GooglePlace[];
  setSearchResults: (value: GooglePlace[]) => void;
  isSearching: boolean;
  setIsSearching: (value: boolean) => void;
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
  // 저장된 일정 데이터를 에디터에 로드 — SavedDayPlanItem[]을 DayPlan[]으로 변환
  loadPlanData: (planNum: number, planName: string, isPublic: boolean, items: SavedDayPlanItem[]) => void;
}

const usePlanStore = create<PlanState>((set) => ({
  searchParams: "",
  setSearchParams: (value) => set({ searchParams: value }),
  searchResults: [],
  setSearchResults: (value) => set({ searchResults: value }),
  isSearching: false,
  setIsSearching: (value) => set({ isSearching: value }),
  currentLatLng: null,
  setCurrentLatLng: (value) => set({ currentLatLng: value }),
  selectedPlace: null,
  setSelectedPlace: (value) => set({ selectedPlace: value }),
  detailPlace: null,
  setDetailPlace: (value) => set({ detailPlace: value }),

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
    dayPlans: state.dayPlans.map((d) =>
      d.date === date
        ? {
            ...d,
            places: d.places.some((p) => p.place_id === place.place_id)
              ? d.places
              : [...d.places, place]
          }
        : d
    )
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
    selectedPlace: null,
    detailPlace: null,
    showExitGuard: false,
    calendarResetKey: state.calendarResetKey + 1,
    currentPlanNum: null,
    currentPlanName: null,
    currentIsPublic: false,
  })),

  currentPlanNum: null,
  currentPlanName: null,
  currentIsPublic: false,
  // 저장된 dayPlans 데이터를 에디터 형식으로 변환해 스토어에 적재
  loadPlanData: (planNum, planName, isPublic, items) => {
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
    set({
      currentPlanNum: planNum,
      currentPlanName: planName,
      currentIsPublic: isPublic,
      dayPlans,
      selectedDate: dayPlans[0]?.date ?? '',
    });
  },
}));

export default usePlanStore;