import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
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

@Injectable()
export class PlaceSearchService {
  private readonly logger = new Logger(PlaceSearchService.name);

  constructor(private readonly config: ConfigService) {}

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

    try {
      const { data } = await axios.post<{ places?: Record<string, unknown>[] }>(
        PLACES_URL,
        {
          textQuery: [name, city].filter(Boolean).join(' '),
          ...(includedType ? { includedType } : {}),
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

      // 스코어링 — 카테고리 타입 일치(+2), 장소명 포함 일치(+1)
      // 도시명은 한국어로 넘어오지만 API 응답 주소는 현지어·영어 — 언어 불일치로 점수화하지 않음
      // 대신 textQuery 자체에 도시명이 포함돼 있어 Google이 이미 지역 필터링을 수행함
      const nameLower = name.toLowerCase();
      const scored = parsed.map((p) => {
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
      // 장소명이 전혀 겹치지 않고 카테고리도 불일치하면 엉뚱한 장소일 가능성이 높음
      // 단, pageSize=3 쿼리 자체(name + city)로 이미 필터됐으므로 첫 번째 결과를 신뢰
      // → score 0이어도 반환 (도트 불일치 케이스: "돈키호테" ↔ "ドン・キホーテ" 등 한자·가나 불일치)
      return scored[0].place;
    } catch (err: unknown) {
      this.logger.error(
        `장소 resolve 실패 — name:${name} category:${category ?? '없음'} error:${String(err)}`,
      );
      return null;
    }
  }
}
