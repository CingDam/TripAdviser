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
  photoUrl?: string | null;
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

  clearDayPlans: () => void;
  resetDayPlans: (dates: string[]) => void;
  reorderDayPlan: (date: string, places: GooglePlace[]) => void;
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
}));

export default usePlanStore;