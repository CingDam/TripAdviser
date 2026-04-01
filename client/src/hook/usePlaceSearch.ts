import usePlanStore, { GooglePlace } from "@/store/usePlanStore";
import { useCallback, useState } from "react";

type PlaceLib = google.maps.PlacesLibrary;
type Map = google.maps.Map;
export type SearchType = 'tourist' | 'restaurant' | 'cafe' | 'shopping' | 'bar' | 'train_station';

const SEARCH_QUERIES: Record<SearchType, string> = {
  tourist:       '관광지 명소',
  restaurant:    '맛집 레스토랑',
  cafe:          '카페 디저트',
  shopping:      '쇼핑 마켓',
  bar:           '술집 바',
  train_station: '기차역',
};

// Basic SKU 필드만 요청 — Enterprise 필드(regularOpeningHours 등)는 상세 패널 열 때 MapHandler에서 별도 호출
const BASIC_FIELDS = ['id', 'displayName', 'location', 'formattedAddress', 'types', 'rating', 'userRatingCount'];

const formatPlace = (p: google.maps.places.Place): GooglePlace => ({
  place_id: p.id,
  name: p.displayName ?? '',
  formatted_address: p.formattedAddress ?? '',
  location: { lat: p.location?.lat() || 0, lng: p.location?.lng() || 0 },
  types: p.types || [],
  rating: p.rating ?? null,
  user_ratings_total: p.userRatingCount ?? null,
  // weekdayDescriptions/phone/website 는 의도적으로 제외 (undefined = 아직 미조회)
  // PlaceDetailContainer가 열릴 때 MapHandler에서 fetchFields로 별도 조회
});

const searchPlacesByCategory = async (
  placeLib: PlaceLib,
  location: string,
  types: SearchType[],
  center?: google.maps.LatLng | null,
  bounds?: google.maps.LatLngBounds | null,
): Promise<GooglePlace[]> => {
  // 카테고리별로 searchByText를 각각 호출하고 결과를 합침
  // Promise.allSettled: 일부 카테고리 요청이 실패해도 나머지 결과는 반환
  const queries = types.map((type) =>
    placeLib.Place.searchByText({
      textQuery: center
        ? SEARCH_QUERIES[type]
        : `${location} ${SEARCH_QUERIES[type]}`,
      fields: BASIC_FIELDS,
      maxResultCount: 20,
      language: 'ko',
      locationRestriction: bounds ?? undefined,
    }),
  );

  const results = await Promise.allSettled(queries);

  return results
    .filter((r): r is PromiseFulfilledResult<{ places: google.maps.places.Place[] }> => r.status === 'fulfilled')
    .flatMap((r) => r.value.places)
    .filter((p, i, arr) => arr.findIndex((a) => a.id === p.id) === i)
    .map(formatPlace)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
};

export const usePlaceSearch = (placeLib: PlaceLib | null, map: Map | null) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const setSearchResults = usePlanStore((state) => state.setSearchResults);
  const setIsSearching   = usePlanStore((state) => state.setIsSearching);

  const search = useCallback(
    async (query: string, types: SearchType[] = ['tourist', 'restaurant', 'cafe'], panTo = false) => {
      if (!placeLib || !map) return;

      setIsLoading(true);
      setIsSearching(true);
      setError(null);

      try {
        const center = panTo ? null : map.getCenter();
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
    [placeLib, map],
  );

  return { isLoading, error, search };
};
