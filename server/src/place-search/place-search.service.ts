import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// 도시 중심에서 이 거리(km)를 넘는 resolve 결과는 동명이소(타국 동일 상호)로 간주해 폐기
// 광역시·교외 관광지까지 포괄하려 넉넉히 잡되, 국가 단위 오삽입(나라↔수원 ~900km)은 걸러낸다
const CITY_RADIUS_KM = 80;
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount';
const NEARBY_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel';

// 허용 타입 — hotel은 lodging으로 좁히고, airport/transit은 자유 텍스트 검색 (역·터미널도 포함)
const TYPE_MAP: Record<string, string | null> = {
  airport: 'airport',
  transit: null, // includedType 없이 자유 검색 — 역·터미널·항구 등 모두 허용
  hotel: 'lodging',
};

// 쇼핑은 includedType 없이 검색 — 돈키호테 같은 discount_store·variety_store는 shopping_mall 타입이 아님
const RESOLVE_TYPE_MAP: Record<string, string> = {
  식당: 'restaurant',
  카페: 'cafe',
};

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  location: { lat: number; lng: number };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
}

export interface NearbyPlace {
  place_id: string;
  name: string;
  formatted_address: string;
  location: { lat: number; lng: number };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
}

// nearby 검색 카테고리 → Google Places includedTypes 매핑
// Google Places API (New)의 priceLevel 문자열 enum → 숫자(0~4) 변환
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const NEARBY_TYPE_MAP: Record<string, string[]> = {
  식당: ['restaurant'],
  카페: ['cafe', 'coffee_shop'],
  관광지: ['tourist_attraction', 'museum', 'amusement_park', 'art_gallery'],
  쇼핑: ['shopping_mall', 'department_store', 'market'],
  자연: ['park', 'national_park', 'beach'],
  문화: ['museum', 'art_gallery', 'cultural_center'],
};

// 두 좌표 사이 직선거리(km) — resolve 결과가 도시 범위 내인지 검증용
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

@Injectable()
export class PlaceSearchService {
  private readonly logger = new Logger(PlaceSearchService.name);
  // 도시명 → 중심 좌표 캐시 — 같은 도시 반복 resolve 시 Geocoding 재호출 방지
  private readonly cityCoordCache = new Map<
    string,
    { lat: number; lng: number } | null
  >();

  constructor(private readonly config: ConfigService) {}

  // 도시명을 중심 좌표로 변환 — resolve 결과의 지역 검증·bias용. 실패 시 null
  private async geocodeCity(
    city: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const key = city.trim().toLowerCase();
    if (this.cityCoordCache.has(key)) return this.cityCoordCache.get(key)!;

    const apiKey = this.config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');
    try {
      const { data } = await axios.get<{
        results?: { geometry?: { location?: { lat: number; lng: number } } }[];
        status: string;
      }>(GEOCODE_URL, {
        params: { address: city, key: apiKey, language: 'ko' },
        timeout: 8_000,
      });
      const loc = data.results?.[0]?.geometry?.location ?? null;
      this.cityCoordCache.set(key, loc);
      return loc;
    } catch (err: unknown) {
      this.logger.warn(`도시 geocode 실패 — city:${city} error:${String(err)}`);
      this.cityCoordCache.set(key, null);
      return null;
    }
  }

  async search(
    query: string,
    type: string,
  ): Promise<{ results: PlaceSearchResult[] }> {
    if (!(type in TYPE_MAP)) {
      throw new BadRequestException(
        "type은 'airport', 'transit', 'hotel' 중 하나여야 합니다",
      );
    }
    const includedType = TYPE_MAP[type];

    // 공항은 도시명만 입력해도 찾도록 "공항"을 덧붙인다 — "인천"만 보내면 Google이
    // 1순위를 "인천광역시"(locality)로 매칭해 includedType:airport 필터에 0개로 걸러진다.
    // 이미 "공항"이 포함돼 있으면 그대로 둬 "인천 공항 공항" 중복을 막는다.
    const textQuery =
      type === 'airport' && !query.includes('공항') ? `${query} 공항` : query;

    const apiKey = this.config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');

    try {
      const { data } = await axios.post<{ places?: Record<string, unknown>[] }>(
        PLACES_URL,
        {
          textQuery,
          // transit은 includedType 없이 자유 텍스트 검색 — 역·터미널·항구 등 모두 허용
          ...(includedType ? { includedType } : {}),
          // 목록 UI에 충분하고 불필요한 데이터 수신 방지
          pageSize: 5,
          languageCode: 'ko',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          timeout: 10_000,
        },
      );

      const results: PlaceSearchResult[] = (data.places ?? []).map((p) => {
        const loc = (p['location'] as Record<string, number>) ?? {};
        const displayName = (p['displayName'] as Record<string, string>) ?? {};
        return {
          place_id: (p['id'] as string) ?? '',
          name: displayName['text'] ?? '',
          formatted_address: (p['formattedAddress'] as string) ?? '',
          location: { lat: loc['latitude'] ?? 0, lng: loc['longitude'] ?? 0 },
          types: (p['types'] as string[]) ?? [],
        };
      });

      this.logger.log(
        `장소 검색 완료 — type:${type} query:${query} results:${results.length}개`,
      );
      return { results };
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        this.logger.error(
          `Google Places API 오류 — type:${type} status:${err.response.status}`,
        );
        throw new BadRequestException(
          `Google Places API 오류: ${err.response.status}`,
        );
      }
      this.logger.error(
        `Google Places API 연결 실패 — type:${type} error:${String(err)}`,
      );
      throw new BadRequestException('Google Places API 연결 실패');
    }
  }

  // 현재 일정 중심 좌표 반경 내 실제 장소를 조회 — AI 추천에 실시간 데이터 주입용
  async searchNearby(
    lat: number,
    lng: number,
    category: string,
    radiusMeters = 1500,
  ): Promise<NearbyPlace[]> {
    const apiKey = this.config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');
    const includedTypes = NEARBY_TYPE_MAP[category] ?? ['point_of_interest'];

    try {
      const { data } = await axios.post<{ places?: Record<string, unknown>[] }>(
        NEARBY_URL,
        {
          includedTypes,
          maxResultCount: 10,
          languageCode: 'ko',
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radiusMeters,
            },
          },
          rankPreference: 'POPULARITY',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': NEARBY_FIELD_MASK,
          },
          timeout: 8_000,
        },
      );

      const places: NearbyPlace[] = (data.places ?? []).map((p) => {
        const loc = (p['location'] as Record<string, number>) ?? {};
        const displayName = (p['displayName'] as Record<string, string>) ?? {};
        return {
          place_id: (p['id'] as string) ?? '',
          name: displayName['text'] ?? '',
          formatted_address: (p['formattedAddress'] as string) ?? '',
          location: { lat: loc['latitude'] ?? 0, lng: loc['longitude'] ?? 0 },
          types: (p['types'] as string[]) ?? [],
          rating: p['rating'] as number | undefined,
          user_ratings_total: p['userRatingCount'] as number | undefined,
          price_level: (() => {
            const raw = p['priceLevel'];
            if (typeof raw === 'number') return raw;
            if (typeof raw === 'string')
              return PRICE_LEVEL_MAP[raw] ?? undefined;
            return undefined;
          })(),
        };
      });

      this.logger.log(
        `nearby 검색 완료 — category:${category} lat:${lat} lng:${lng} results:${places.length}개`,
      );
      return places;
    } catch (err: unknown) {
      this.logger.error(
        `nearby 검색 실패 — category:${category} error:${String(err)}`,
      );
      return [];
    }
  }

  // 두 장소 사이 중간 좌표 근처 교통 거점 후보 조회 — transit_station·bus_station·subway_station 대상
  async searchNearbyTransit(
    lat: number,
    lng: number,
    radiusMeters = 1000,
  ): Promise<NearbyPlace[]> {
    const apiKey = this.config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');

    try {
      const { data } = await axios.post<{ places?: Record<string, unknown>[] }>(
        NEARBY_URL,
        {
          includedTypes: [
            'transit_station',
            'subway_station',
            'bus_station',
            'train_station',
          ],
          maxResultCount: 5,
          languageCode: 'ko',
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radiusMeters,
            },
          },
          rankPreference: 'POPULARITY',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': NEARBY_FIELD_MASK,
          },
          timeout: 8_000,
        },
      );

      const places: NearbyPlace[] = (data.places ?? []).map((p) => {
        const loc = (p['location'] as Record<string, number>) ?? {};
        const displayName = (p['displayName'] as Record<string, string>) ?? {};
        return {
          place_id: (p['id'] as string) ?? '',
          name: displayName['text'] ?? '',
          formatted_address: (p['formattedAddress'] as string) ?? '',
          location: { lat: loc['latitude'] ?? 0, lng: loc['longitude'] ?? 0 },
          types: (p['types'] as string[]) ?? [],
          rating: p['rating'] as number | undefined,
          user_ratings_total: p['userRatingCount'] as number | undefined,
        };
      });

      this.logger.log(
        `nearby-transit 검색 완료 — lat:${lat} lng:${lng} results:${places.length}개`,
      );
      return places;
    } catch (err: unknown) {
      this.logger.error(`nearby-transit 검색 실패 — error:${String(err)}`);
      return [];
    }
  }

  // 두 좌표 사이 실제 도보 이동 시간(분)을 조회 — 직선거리로 애매한 구간의 역 삽입 판단용
  // 직선거리는 강·산 우회를 반영하지 못하므로, 회색지대(도보/탑승 경계)만 실제 경로로 확인한다
  // 실패(타임아웃·할당량 초과 등) 시 null 반환 → 호출부가 직선거리 폴백으로 처리
  async walkMinutes(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<number | null> {
    const apiKey = this.config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');

    try {
      const { data } = await axios.post<{
        routes?: { duration?: string }[];
      }>(
        ROUTES_URL,
        {
          origin: {
            location: {
              latLng: { latitude: from.lat, longitude: from.lng },
            },
          },
          destination: {
            location: { latLng: { latitude: to.lat, longitude: to.lng } },
          },
          travelMode: 'WALK',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            // duration만 받아 Essentials 티어 유지 (경로 폴리라인 등은 Pro 과금)
            'X-Goog-FieldMask': 'routes.duration',
          },
          timeout: 8_000,
        },
      );

      const route = data.routes?.[0];
      if (!route?.duration) return null;
      // duration은 "1234s" 형식 문자열 — 초를 분으로 변환
      const seconds = parseInt(route.duration.replace('s', ''), 10);
      if (Number.isNaN(seconds)) return null;
      return seconds / 60;
    } catch (err: unknown) {
      this.logger.warn(`도보시간 조회 실패 — error:${String(err)}`);
      return null;
    }
  }

  // AI 자동생성 장소를 실제 Google place_id·좌표로 변환
  // 후보 3개를 받아 도시명 포함 여부 + 카테고리 타입 일치로 스코어링 — 동명이소 오삽입 방지
  async resolvePlace(
    name: string,
    city: string,
    category?: string,
  ): Promise<PlaceSearchResult | null> {
    const apiKey = this.config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');
    const includedType = category ? RESOLVE_TYPE_MAP[category] : undefined;

    // 도시 중심 좌표 — locationBias로 동명이소(타국 동일 상호) 오삽입 방지
    // "멘야고코로 나라" 검색 시 Google이 한국 수원점을 1순위로 주던 문제의 근본 차단
    const cityCoord = city ? await this.geocodeCity(city) : null;

    try {
      const { data } = await axios.post<{ places?: Record<string, unknown>[] }>(
        PLACES_URL,
        {
          textQuery: [name, city].filter(Boolean).join(' '),
          ...(includedType ? { includedType } : {}),
          // 도시 중심 반경으로 검색 편향 — 결과 순위를 그 지역으로 끌어온다
          ...(cityCoord
            ? {
                locationBias: {
                  circle: {
                    center: {
                      latitude: cityCoord.lat,
                      longitude: cityCoord.lng,
                    },
                    radius: CITY_RADIUS_KM * 1000,
                  },
                },
              }
            : {}),
          // 후보 3개 조회 후 스코어링 — pageSize 1이면 동명이소 첫 번째가 그냥 반환됨
          pageSize: 3,
          languageCode: 'ko',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          timeout: 10_000,
        },
      );

      const candidates = data.places ?? [];
      if (candidates.length === 0) return null;

      const parsed = candidates.map((p) => {
        const loc = (p['location'] as Record<string, number>) ?? {};
        const displayName = (p['displayName'] as Record<string, string>) ?? {};
        return {
          place_id: (p['id'] as string) ?? '',
          name: displayName['text'] ?? name,
          formatted_address: (p['formattedAddress'] as string) ?? '',
          location: { lat: loc['latitude'] ?? 0, lng: loc['longitude'] ?? 0 },
          types: (p['types'] as string[]) ?? [],
        };
      });

      // 도시 좌표를 알면 범위 밖 후보를 먼저 제거 — 동명이소 타국 장소 차단(나라↔수원)
      // 모든 후보가 범위 밖이면 신뢰할 결과가 없으므로 null (역·식당 모두 오삽입 방지)
      const inCity = cityCoord
        ? parsed.filter(
            (p) =>
              p.location.lat !== 0 &&
              haversineKm(cityCoord, p.location) <= CITY_RADIUS_KM,
          )
        : parsed;
      if (cityCoord && inCity.length === 0) {
        this.logger.warn(
          `resolve 도시 범위 밖 — name:${name} city:${city} 후보 전부 ${CITY_RADIUS_KM}km 초과로 폐기`,
        );
        return null;
      }

      // 스코어링 — 카테고리 타입 일치(+2), 장소명 포함 일치(+1)
      // 도시명은 한국어로 넘어오지만 API 응답 주소는 현지어·영어 — 언어 불일치로 점수화하지 않음
      const nameLower = name.toLowerCase();
      const scored = inCity.map((p) => {
        let score = 0;
        if (
          p.name.toLowerCase().includes(nameLower) ||
          nameLower.includes(p.name.toLowerCase())
        )
          score += 1;
        if (includedType && p.types.includes(includedType)) score += 2;
        return { place: p, score };
      });

      scored.sort((a, b) => b.score - a.score);
      // 도시 범위 검증을 통과한 후보 중 최고 점수 — score 0이어도 반환
      // (도트 불일치 케이스: "돈키호테" ↔ "ドン・キホーテ" 등 한자·가나 불일치)
      return scored[0].place;
    } catch (err: unknown) {
      this.logger.error(
        `장소 resolve 실패 — name:${name} category:${category ?? '없음'} error:${String(err)}`,
      );
      return null;
    }
  }
}
