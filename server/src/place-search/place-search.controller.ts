import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, MaxLength } from 'class-validator';
import { PlaceSearchService } from './place-search.service';

class ResolvePlaceDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(100)
  city: string;
}

@Controller('place-search')
@UseGuards(AuthGuard('jwt'))
export class PlaceSearchController {
  constructor(private readonly placeSearchService: PlaceSearchService) {}

  @Get()
  search(
    @Query('query') query: string,
    @Query('type') type: string,
  ) {
    return this.placeSearchService.search(query, type);
  }

  // AI 자동생성 장소명을 실제 Google place_id·좌표로 변환
  @Post('resolve')
  resolvePlace(@Body() dto: ResolvePlaceDto) {
    return this.placeSearchService.resolvePlace(dto.name, dto.city);
  }
}
