import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entities/city.entity';

@Injectable()
export class CityService {
  constructor(
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
  ) {}

  findAll(): Promise<City[]> {
    return this.cityRepo.find({ order: { planCount: 'DESC' } });
  }

  async findOne(cityNum: number): Promise<City> {
    const city = await this.cityRepo.findOne({ where: { cityNum } });
    if (!city) throw new NotFoundException('도시를 찾을 수 없습니다');
    return city;
  }
}
