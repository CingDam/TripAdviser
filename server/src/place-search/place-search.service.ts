import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types';

// 허용 타입 — 공항·호텔만 지원 (SlotEditModal·TripSetupModal용)
const TYPE_MAP: Record<string, string> = {
  airport: 'airport',
  hotel: 'lodging',
};

const RESOLVE_TYPE_MAP: Record<string, string> = {
  식당: 'restaurant',
  카페: 'cafe',
  쇼핑: 'shopping_mall',
};

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  location: { lat: number; lng: number };
  types: string[];
}

@Injectable()
export class PlaceSearchService {
  private readonly logger = new Logger(PlaceSearchService.name);

  constructor(private readonly config: ConfigService) {}

  async search(
    query: string,
    type: string,
  ): Promise<{ results: PlaceSearchResult[] }> {
    const includedType = TYPE_MAP[type];
    if (!includedType) {
      throw new BadRequestException(
        "type은 'airport' 또는 'hotel'이어야 합니다",
      );
    }

    const apiKey = this.config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');

    try {
      const { data } = await axios.post<{ places?: Record<string, unknown>[] }>(
        PLACES_URL,
        {
          textQuery: query,
          includedType,
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

  // AI 자동생성 장소를 실제 Google place_id·좌표로 변환 — 카테고리 힌트가 있으면 Places 타입으로 좁혀 검색
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
          textQuery: [name, city, category].filter(Boolean).join(' '),
          ...(includedType ? { includedType } : {}),
          pageSize: 1,
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

      const place = (data.places ?? [])[0];
      if (!place) return null;

      const loc = (place['location'] as Record<string, number>) ?? {};
      const displayName =
        (place['displayName'] as Record<string, string>) ?? {};
      return {
        place_id: (place['id'] as string) ?? '',
        name: displayName['text'] ?? name,
        formatted_address: (place['formattedAddress'] as string) ?? '',
        location: { lat: loc['latitude'] ?? 0, lng: loc['longitude'] ?? 0 },
        types: (place['types'] as string[]) ?? [],
      };
    } catch (err: unknown) {
      this.logger.error(
        `장소 resolve 실패 — name:${name} category:${category ?? '없음'} error:${String(err)}`,
      );
      return null;
    }
  }
}
