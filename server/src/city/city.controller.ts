import { Controller, Get } from '@nestjs/common';
import { CityService } from './city.service';

@Controller('city')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  // GET /api/city — 도시 목록 (plan_count 내림차순)
  @Get()
  findAll() {
    return this.cityService.findAll();
  }
}
