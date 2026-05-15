import usePlanStore, { GooglePlace } from "@/store/usePlanStore";
import { useCallback, useRef } from "react";

type PlaceLib = google.maps.PlacesLibrary;
type Map = google.maps.Map;
export type SearchType = 'tourist' | 'restaurant' | 'cafe' | 'shopping' | 'bar' | 'hotel' | 'transport';

// 카테고리당 여러 서브쿼리로 분산 검색 — 단일 쿼리 20개 한도를 우회해 다양성 확보
const SEARCH_QUERIES: Record<SearchType, string[]> = {
  tourist:   ['tourist attraction landmark', 'museum art gallery', 'amusement park theme park', 'park nature scenic'],
  restaurant: ['restaurant local food', 'fine dining seafood'],
  cafe:       ['cafe coffee', 'dessert bakery'],
  shopping:   ['shopping mall department store fashion', 'market souvenir shop duty free'],
  bar:        ['bar pub nightclub'],
  hotel:      ['hotel resort accommodation'],
  transport:  ['train station subway', 'bus station airport ferry'],
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
    // panTo=true(도시 진입 자동검색)일 때 도시 중심 좌표 — 글로벌 검색 방지용 반경 제한에 사용
    cityCenter?: { lat: number; lng: number } | null,
  ) => {
    if (!placeLib || !map) return;

    setIsSearching(true);
    setHasMore(false);

    try {
      // panTo=true: 도시 중심 기준 약 20km 정사각 bounds로 제한 — 글로벌 검색 방지
      // panTo=false: 현재 지도 영역(getBounds)으로 제한
      // SearchByTextRequest.locationRestriction은 LatLngBounds만 허용 — Circle 불가
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

      const allPlaces: GooglePlace[] = [];

      for (const type of types) {
        for (const subQuery of SEARCH_QUERIES[type]) {
          try {
            const q = panTo ? `${query} ${subQuery}` : subQuery;
            const places = await searchOneCategory(placeLib, q, restriction);
            allPlaces.push(...places.map(formatPlace));
          } catch {
            // 개별 서브쿼리 실패 무시 — 다음 쿼리 계속 진행
          }
        }
      }

      // bounds 밖 장소 후처리 필터 — API locationRestriction이 완벽하지 않아 이중 검증
      const inBounds = restriction
        ? allPlaces.filter((p) => restriction!.contains({ lat: p.location.lat, lng: p.location.lng }))
        : allPlaces;

      // 중복 제거 후 평점 × log(리뷰 수) 점수순 정렬
      // 카테고리 편향 없이 실제 인기도(평점 × 방문량)가 높은 곳이 상위에 오도록 함
      // log 사용 이유: 리뷰 수가 선형으로 점수에 영향하면 대형 관광지가 지나치게 유리해짐
      const score = (p: GooglePlace) =>
        (p.rating ?? 0) * Math.log10((p.user_ratings_total ?? 1) + 1);

      const deduped = inBounds
        .filter((p, i, arr) => arr.findIndex((a) => a.place_id === p.place_id) === i)
        .sort((a, b) => score(b) - score(a));

      // 첫 20개만 표시 — 나머지는 버퍼에 보관
      const firstPage = deduped.slice(0, PAGE_SIZE);
      const buffer    = deduped.slice(PAGE_SIZE);

      setSearchResults(firstPage);
      setHasMore(buffer.length > 0);

      const bounds = panTo ? null : map.getBounds() ?? null;
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
