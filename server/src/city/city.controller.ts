import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CityService } from './city.service';
import { CreateCityDto } from './dto/create-city.dto';

@Controller('city')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  // GET /api/city — 도시 목록 (plan_count 내림차순)
  @Get()
  findAll() {
    return this.cityService.findAll();
  }

  // GET /api/city/:id — 도시 단건 조회
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cityService.findOne(id);
  }

  // POST /api/city — 도시 추가 (JWT 필수) + Pexels 대표 이미지 자동 저장
  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateCityDto) {
    return this.cityService.create(dto);
  }
}
