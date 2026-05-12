import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types';

// 허용 타입 — 공항·호텔만 지원
const TYPE_MAP: Record<string, string> = {
  airport: 'airport',
  hotel: 'lodging',
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
      throw new BadRequestException("type은 'airport' 또는 'hotel'이어야 합니다");
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

      this.logger.log(`장소 검색 완료 — type:${type} query:${query} results:${results.length}개`);
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
      this.logger.error(`Google Places API 연결 실패 — type:${type} error:${String(err)}`);
      throw new BadRequestException('Google Places API 연결 실패');
    }
  }
}
