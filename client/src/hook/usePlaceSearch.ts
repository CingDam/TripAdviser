import usePlanStore, { GooglePlace } from "@/store/usePlanStore";
import { useCallback, useState } from "react";

type PlaceLib = google.maps.PlacesLibrary;
type Map = google.maps.Map;
export type SearchType = 'tourist' | 'restaurant' | 'cafe' | 'shopping' | 'bar' | 'train_station';

const SEARCH_QUERIES: Record<SearchType, string> = {
  tourist: '관광지 명소',
  restaurant: '맛집 레스토랑',
  cafe: '카페 디저트',
  shopping: '쇼핑 마켓',
  bar: '술집 바',
  train_station: '기차역'
};

const formatPlace = (p: google.maps.places.Place): GooglePlace => {
  // isOpen()은 영업시간 데이터가 불완전하면 예외를 던질 수 있어서 try-catch로 감쌈
  // 예외 시 null 반환 → UI에서 영업 상태 미표시
  let openNow: boolean | null = null;
  try {
    openNow = p.regularOpeningHours?.isOpen() ?? null;
  } catch {
    openNow = null;
  }

  return {
    place_id: p.id,
    name: p.displayName ?? '',
    formatted_address: p.formattedAddress ?? '',
    location: { lat: p.location?.lat() || 0, lng: p.location?.lng() || 0 },
    types: p.types || [],
    rating: p.rating ?? null,
    user_ratings_total: p.userRatingCount ?? null,
    // 400px 기준으로 저장 — 썸네일은 CSS로 축소, 상세 패널 hero 이미지로 활용
    photoUrl: p.photos?.[0]?.getURI({ maxWidth: 400 }) ?? null,
    openNow,
    // weekdayDescriptions: ["월요일: 오전 9:00 ~ 오후 10:00", ...] 형태의 배열
    weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions ?? null,
    phone: p.nationalPhoneNumber ?? null,
    // websiteURI: 새 Places API(v2) 프로퍼티명 (URI 대문자)
    website: p.websiteURI ?? null,
  };
};

const searchPlacesByCategory = async (
    placeLib: PlaceLib,
    location: string,
    types: SearchType[],
    center?: google.maps.LatLng | null,
    bounds?: google.maps.LatLngBounds | null // ← 추가
  ): Promise<GooglePlace[]> => {
  
    const queries = types.map((type) =>
      placeLib.Place.searchByText({
        textQuery: center
          ? SEARCH_QUERIES[type]
          : `${location} ${SEARCH_QUERIES[type]}`,
        fields: ['id', 'displayName', 'location', 'formattedAddress', 'types', 'rating', 'userRatingCount', 'photos', 'regularOpeningHours', 'nationalPhoneNumber', 'websiteURI'],
        maxResultCount: 20,
        language: 'ko',
        locationRestriction: bounds ?? undefined,
      })
    );
  
    const results = await Promise.allSettled(queries);
  
    return results
      .filter((r): r is PromiseFulfilledResult<{ places: google.maps.places.Place[] }> => r.status === 'fulfilled')
      .flatMap((r) => r.value.places)
      .filter((p, i, arr) => arr.findIndex((a) => a.id === p.id) === i)
      .map(formatPlace)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  };

// hooks/usePlaceSearch.ts
export const usePlaceSearch = (placeLib: PlaceLib | null, map: Map | null) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const setSearchResults = usePlanStore(state => state.setSearchResults);
    const setIsSearching = usePlanStore(state => state.setIsSearching);
  
    const search = useCallback(
        async (query: string, types: SearchType[] = ['tourist', 'restaurant', 'cafe'], panTo = false) => {
          if (!placeLib || !map) return;
      
          setIsLoading(true);
          setIsSearching(true);
          setError(null);
      
          try {
            const center = panTo ? null : map.getCenter(); // ← panTo일 때 center도 null
            const bounds = panTo ? null : map.getBounds();
      
            const places = await searchPlacesByCategory(placeLib, query, types, center, bounds);
            setSearchResults(places);
      
            if (places[0] && panTo) {
              map.panTo(places[0].location);
            }
          } catch (err) {
            setError(err instanceof Error ? err : new Error('검색 실패'));
          } finally {
            setIsLoading(false);
            setIsSearching(false);
          }
        },
        [placeLib, map]
      );
  
    return { isLoading, error, search }; // results 제거
  };