import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface PexelsPhoto {
  src: {
    large2x: string;
    large: string;
  };
}

interface PexelsResponse {
  photos: PexelsPhoto[];
  total_results: number;
}

@Injectable()
export class PexelsService {
  private readonly logger = new Logger(PexelsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.pexels.com/v1';

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.apiKey = this.config.getOrThrow<string>('PEXELS_API_KEY');
  }

  // 도시명 + 국가명으로 대표 이미지 URL 반환 — 결과 없으면 null
  async fetchCityImageUrl(
    cityName: string,
    country: string,
  ): Promise<string | null> {
    const query = `${cityName} ${country} city`;

    try {
      const response = await firstValueFrom(
        this.http.get<PexelsResponse>(`${this.baseUrl}/search`, {
          params: { query, per_page: 1, orientation: 'landscape' },
          headers: { Authorization: this.apiKey },
        }),
      );

      const photo = response.data.photos[0];
      if (!photo) {
        this.logger.warn(`Pexels 검색 결과 없음 — query="${query}"`);
        return null;
      }

      return photo.src.large2x;
    } catch (error: unknown) {
      this.logger.error(
        `Pexels 이미지 조회 실패 — query="${query}"`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }
}
