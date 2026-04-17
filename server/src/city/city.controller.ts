import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CityService } from './city.service';

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
}
