import usePlanStore, { GooglePlace } from "@/store/usePlanStore";
import { useCallback, useRef } from "react";

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
const BASIC_FIELDS = ['id', 'displayName', 'location', 'formattedAddress', 'types', 'rating', 'userRatingCount', 'priceLevel'];

// 첫 검색 시 카테고리당 결과 수 — 20개씩 추가 로드
const PAGE_SIZE = 20;

const formatPlace = (p: google.maps.places.Place): GooglePlace => ({
  place_id: p.id,
  name: p.displayName ?? '',
  formatted_address: p.formattedAddress ?? '',
  location: { lat: p.location?.lat() || 0, lng: p.location?.lng() || 0 },
  types: p.types || [],
  rating: p.rating ?? null,
  user_ratings_total: p.userRatingCount ?? null,
  // PriceLevel은 Google Places enum — number로 변환해서 저장
  priceLevel: p.priceLevel != null ? Number(p.priceLevel) : null,
  // weekdayDescriptions/phone/website 는 의도적으로 제외 (undefined = 아직 미조회)
  // PlaceDetailContainer가 열릴 때 MapHandler에서 fetchFields로 별도 조회
});

// 단일 카테고리 검색
const searchOneCategory = async (
  placeLib: PlaceLib,
  query: string,
  bounds: google.maps.LatLngBounds | null | undefined,
): Promise<google.maps.places.Place[]> => {
  const { places } = await placeLib.Place.searchByText({
    textQuery: query,
    fields: BASIC_FIELDS,
    maxResultCount: PAGE_SIZE,
    language: 'ko',
    ...(bounds ? { locationRestriction: bounds } : {}),
  });
  return places;
};

export const usePlaceSearch = (placeLib: PlaceLib | null, map: Map | null) => {
  const setSearchResults    = usePlanStore((s) => s.setSearchResults);
  const appendSearchResults = usePlanStore((s) => s.appendSearchResults);
  const setIsSearching      = usePlanStore((s) => s.setIsSearching);
  const setIsLoadingMore    = usePlanStore((s) => s.setIsLoadingMore);
  const setHasMore          = usePlanStore((s) => s.setHasMore);

  // 현재 검색 컨텍스트 — loadMore 시 동일 조건으로 다음 페이지 요청에 사용
  const searchContextRef = useRef<{
    query: string;
    types: SearchType[];
    bounds: google.maps.LatLngBounds | null;
    // 카테고리별 남은 결과 버퍼 — 첫 검색에서 20개 초과분을 여기에 보관했다가 loadMore 시 꺼냄
    buffer: GooglePlace[];
  } | null>(null);

  // 새 검색 — 결과를 교체하고 컨텍스트를 초기화
  // 카테고리 순차 호출 — 병렬 호출 시 Rate Limit(429) 위험
  const search = useCallback(async (
    query: string,
    types: SearchType[],
    panTo = false,
  ) => {
    if (!placeLib || !map) return;

    setIsSearching(true);
    setHasMore(false);

    try {
      const bounds = panTo ? null : map.getBounds() ?? null;
      const allPlaces: GooglePlace[] = [];

      for (const type of types) {
        try {
          const q = panTo ? `${query} ${SEARCH_QUERIES[type]}` : SEARCH_QUERIES[type];
          const places = await searchOneCategory(placeLib, q, bounds);
          allPlaces.push(...places.map(formatPlace));
        } catch {
          // 개별 카테고리 실패 무시 — 다음 카테고리 계속 진행
        }
      }

      // 중복 제거 후 평점순 정렬
      const deduped = allPlaces
        .filter((p, i, arr) => arr.findIndex((a) => a.place_id === p.place_id) === i)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

      // 첫 20개만 표시 — 나머지는 버퍼에 보관
      const firstPage = deduped.slice(0, PAGE_SIZE);
      const buffer    = deduped.slice(PAGE_SIZE);

      setSearchResults(firstPage);
      setHasMore(buffer.length > 0);

      searchContextRef.current = { query, types, bounds, buffer };

      if (firstPage[0] && panTo) map.panTo(firstPage[0].location);
    } finally {
      setIsSearching(false);
    }
  }, [placeLib, map, setSearchResults, setIsSearching, setHasMore]);

  // 추가 로드 — 버퍼에서 20개씩 꺼냄 (API 추가 호출 없음)
  const loadMore = useCallback(async () => {
    const ctx = searchContextRef.current;
    if (!ctx || ctx.buffer.length === 0) return;

    setIsLoadingMore(true);

    const nextPage = ctx.buffer.slice(0, PAGE_SIZE);
    const remaining = ctx.buffer.slice(PAGE_SIZE);

    searchContextRef.current = { ...ctx, buffer: remaining };

    appendSearchResults(nextPage);
    setHasMore(remaining.length > 0);
    setIsLoadingMore(false);
  }, [appendSearchResults, setHasMore, setIsLoadingMore]);

  return { search, loadMore };
};
