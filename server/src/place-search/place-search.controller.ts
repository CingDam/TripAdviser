import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
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
}
