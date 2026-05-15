import usePlanStore, { GooglePlace } from "@/store/usePlanStore";
import { useCallback, useRef } from "react";

type PlaceLib = google.maps.PlacesLibrary;
type Map = google.maps.Map;
export type SearchType = 'tourist' | 'restaurant' | 'cafe' | 'shopping' | 'bar' | 'hotel' | 'transport';

// 카테고리당 서브쿼리 목록 — 첫 검색은 index 0만 호출, 더 보기 시 순서대로 추가 호출
const SEARCH_QUERIES: Record<SearchType, string[]> = {
  tourist:    ['tourist attraction landmark', 'museum art gallery', 'amusement park theme park', 'park nature scenic'],
  restaurant: ['restaurant local food', 'fine dining seafood'],
  cafe:       ['cafe coffee', 'dessert bakery'],
  shopping:   ['shopping mall department store fashion', 'market souvenir shop duty free'],
  bar:        ['bar pub nightclub'],
  hotel:      ['hotel resort accommodation'],
  transport:  ['train station subway', 'bus station airport ferry'],
};

// Basic SKU 필드만 요청 — Enterprise 필드(regularOpeningHours 등)는 상세 패널 열 때 MapHandler에서 별도 호출
const BASIC_FIELDS = ['id', 'displayName', 'location', 'formattedAddress', 'types', 'rating', 'userRatingCount', 'priceLevel'];

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

const searchOneCategory = async (
  placeLib: PlaceLib,
  query: string,
  restriction: google.maps.LatLngBounds | null | undefined,
): Promise<google.maps.places.Place[]> => {
  const { places } = await placeLib.Place.searchByText({
    textQuery: query,
    fields: BASIC_FIELDS,
    maxResultCount: PAGE_SIZE,
    language: 'ko',
    ...(restriction ? { locationRestriction: restriction } : {}),
  });
  return places;
};

// 인기도 점수 — 카테고리 편향 없이 실제 방문량이 높은 곳이 상위에 오도록
// log 사용 이유: 리뷰 수가 선형으로 영향하면 대형 관광지가 지나치게 유리해짐
const score = (p: GooglePlace) =>
  (p.rating ?? 0) * Math.log10((p.user_ratings_total ?? 1) + 1);

const dedupeAndSort = (places: GooglePlace[], existing: GooglePlace[]): GooglePlace[] => {
  const seenIds = new Set(existing.map((p) => p.place_id));
  return places
    .filter((p) => !seenIds.has(p.place_id))
    .sort((a, b) => score(b) - score(a));
};

export const usePlaceSearch = (placeLib: PlaceLib | null, map: Map | null) => {
  const setSearchResults    = usePlanStore((s) => s.setSearchResults);
  const appendSearchResults = usePlanStore((s) => s.appendSearchResults);
  const searchResults       = usePlanStore((s) => s.searchResults);
  const setIsSearching      = usePlanStore((s) => s.setIsSearching);
  const setIsLoadingMore    = usePlanStore((s) => s.setIsLoadingMore);
  const setHasMore          = usePlanStore((s) => s.setHasMore);

  // 현재 검색 컨텍스트 — 더 보기 시 남은 서브쿼리를 순서대로 호출하는 데 사용
  const searchContextRef = useRef<{
    query: string;
    panTo: boolean;
    restriction: google.maps.LatLngBounds | null;
    // 카테고리별 남은 서브쿼리 인덱스 — [type, subQueryIndex] 쌍의 큐
    remainingSubQueries: { type: SearchType; queryIndex: number }[];
  } | null>(null);

  const searchResultsRef = useRef<GooglePlace[]>([]);
  searchResultsRef.current = searchResults;

  // 새 검색 — 각 카테고리의 첫 번째 서브쿼리만 호출하고 나머지는 컨텍스트에 보관
  // 카테고리 순차 호출 — 병렬 호출 시 Rate Limit(429) 위험
  const search = useCallback(async (
    query: string,
    types: SearchType[],
    panTo = false,
    // panTo=true(도시 진입 자동검색)일 때 도시 중심 좌표 — 글로벌 검색 방지용 반경 제한에 사용
    cityCenter?: { lat: number; lng: number } | null,
  ) => {
    if (!placeLib || !map) return;

    setIsSearching(true);
    setHasMore(false);

    try {
      let restriction: google.maps.LatLngBounds | null = null;
      if (panTo && cityCenter) {
        // 위도 1도 ≈ 111km → 0.18° ≈ 20km 반경 근사 정사각 박스
        const DELTA = 0.18;
        restriction = new google.maps.LatLngBounds(
          { lat: cityCenter.lat - DELTA, lng: cityCenter.lng - DELTA },
          { lat: cityCenter.lat + DELTA, lng: cityCenter.lng + DELTA },
        );
      } else if (!panTo) {
        restriction = map.getBounds() ?? null;
      }

      const firstPagePlaces: GooglePlace[] = [];
      // 더 보기용 남은 서브쿼리 큐 — 첫 번째(index 0) 이후 나머지를 순서대로 보관
      const remainingSubQueries: { type: SearchType; queryIndex: number }[] = [];

      for (const type of types) {
        const queries = SEARCH_QUERIES[type];
        // 첫 번째 서브쿼리만 즉시 호출
        try {
          const q = panTo ? `${query} ${queries[0]}` : queries[0];
          const places = await searchOneCategory(placeLib, q, restriction);
          firstPagePlaces.push(...places.map(formatPlace));
        } catch {
          // 개별 서브쿼리 실패 무시
        }
        // 나머지 서브쿼리는 큐에 보관
        for (let i = 1; i < queries.length; i++) {
          remainingSubQueries.push({ type, queryIndex: i });
        }
      }

      // bounds 밖 장소 후처리 필터 — API locationRestriction이 완벽하지 않아 이중 검증
      const inBounds = restriction
        ? firstPagePlaces.filter((p) => restriction!.contains({ lat: p.location.lat, lng: p.location.lng }))
        : firstPagePlaces;

      const sorted = dedupeAndSort(inBounds, []);

      setSearchResults(sorted);
      setHasMore(remainingSubQueries.length > 0);

      searchContextRef.current = { query, panTo, restriction, remainingSubQueries };

      if (sorted[0] && panTo) map.panTo(sorted[0].location);
    } finally {
      setIsSearching(false);
    }
  }, [placeLib, map, setSearchResults, setIsSearching, setHasMore]);

  // 더 보기 — 남은 서브쿼리를 카테고리 순서대로 한 번에 하나씩 호출
  const loadMore = useCallback(async () => {
    const ctx = searchContextRef.current;
    if (!ctx || ctx.remainingSubQueries.length === 0 || !placeLib) return;

    setIsLoadingMore(true);

    try {
      const { type, queryIndex } = ctx.remainingSubQueries[0];
      const remaining = ctx.remainingSubQueries.slice(1);
      const rawQuery = SEARCH_QUERIES[type][queryIndex];
      const q = ctx.panTo ? `${ctx.query} ${rawQuery}` : rawQuery;

      try {
        const places = await searchOneCategory(placeLib, q, ctx.restriction);
        const mapped = places.map(formatPlace);

        const inBounds = ctx.restriction
          ? mapped.filter((p) => ctx.restriction!.contains({ lat: p.location.lat, lng: p.location.lng }))
          : mapped;

        // 이미 표시 중인 결과와 중복 제거 후 정렬해서 추가
        const newPlaces = dedupeAndSort(inBounds, searchResultsRef.current);
        if (newPlaces.length > 0) appendSearchResults(newPlaces);
      } catch {
        // 개별 서브쿼리 실패 무시
      }

      searchContextRef.current = { ...ctx, remainingSubQueries: remaining };
      setHasMore(remaining.length > 0);
    } finally {
      setIsLoadingMore(false);
    }
  }, [placeLib, appendSearchResults, setHasMore, setIsLoadingMore]);

  return { search, loadMore };
};
