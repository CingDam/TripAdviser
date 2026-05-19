import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PlaceSearchService } from './place-search.service';

class ResolvePlaceDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  category?: string;
}

class NearbySearchDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsString()
  @MaxLength(20)
  category: string;

  @IsOptional()
  @IsNumber()
  @Min(200)
  @Max(5000)
  radius?: number;
}

@Controller('place-search')
export class PlaceSearchController {
  constructor(private readonly placeSearchService: PlaceSearchService) {}

  // 비로그인도 공항·호텔 검색 가능 — TripSetupModal에서 인증 없이 호출
  @Get()
  search(@Query('query') query: string, @Query('type') type: string) {
    return this.placeSearchService.search(query, type);
  }

  // AI 자동생성 장소명을 실제 Google place_id·좌표로 변환 — 비로그인도 챗봇·자동생성에서 호출 가능
  @Post('resolve')
  resolvePlace(@Body() dto: ResolvePlaceDto) {
    return this.placeSearchService.resolvePlace(
      dto.name,
      dto.city,
      dto.category,
    );
  }

  // 현재 일정 중심 좌표 반경 내 실제 장소 조회 — 챗봇 근처 추천에 실시간 데이터 주입용
  @Post('nearby')
  searchNearby(@Body() dto: NearbySearchDto) {
    return this.placeSearchService.searchNearby(
      dto.lat,
      dto.lng,
      dto.category,
      dto.radius,
    );
  }
}
