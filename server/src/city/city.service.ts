import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entities/city.entity';

@Injectable()
export class CityService {
  private readonly logger = new Logger(CityService.name);

  constructor(
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
  ) {}

  async findAll(): Promise<City[]> {
    try {
      const cities = await this.cityRepo.find({ order: { planCount: 'DESC' } });
      this.logger.log(`도시 목록 조회 성공 — ${cities.length}개`);
      return cities;
    } catch (error: unknown) {
      this.logger.error('도시 목록 조회 실패', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  async findOne(cityNum: number): Promise<City> {
    try {
      const city = await this.cityRepo.findOne({ where: { cityNum } });
      if (!city) throw new NotFoundException('도시를 찾을 수 없습니다');
      return city;
    } catch (error: unknown) {
      this.logger.error(`도시 단건 조회 실패 cityNum=${cityNum}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}
