import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entities/city.entity';
import { CreateCityDto } from './dto/create-city.dto';
import { PexelsService } from './pexels.service';

@Injectable()
export class CityService {
  private readonly logger = new Logger(CityService.name);

  constructor(
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
    private readonly pexels: PexelsService,
  ) {}

  async findAll(): Promise<City[]> {
    try {
      const cities = await this.cityRepo.find({ order: { planCount: 'DESC' } });
      this.logger.log(`도시 목록 조회 성공 — ${cities.length}개`);
      cities.forEach((c) =>
        this.logger.log(`  [${c.cityNum}] ${c.cityName} (${c.country}) plan_count=${c.planCount}`),
      );
      return cities;
    } catch (error: unknown) {
      this.logger.error(
        '도시 목록 조회 실패',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async findOne(cityNum: number): Promise<City> {
    try {
      const city = await this.cityRepo.findOne({ where: { cityNum } });
      if (!city) throw new NotFoundException('도시를 찾을 수 없습니다');
      return city;
    } catch (error: unknown) {
      this.logger.error(
        `도시 단건 조회 실패 cityNum=${cityNum}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async create(dto: CreateCityDto): Promise<City> {
    const existing = await this.cityRepo.findOne({
      where: { cityName: dto.cityName, country: dto.country },
    });
    if (existing) {
      throw new ConflictException(
        `이미 등록된 도시입니다 — ${dto.cityName}, ${dto.country}`,
      );
    }

    // Pexels에서 도시 대표 이미지 자동 검색 — 실패해도 도시 생성은 진행
    const imageUrl = await this.pexels.fetchCityImageUrl(
      dto.cityName,
      dto.country,
    );

    if (imageUrl) {
      this.logger.log(`Pexels 이미지 연결 — ${dto.cityName}: ${imageUrl}`);
    } else {
      this.logger.warn(
        `Pexels 이미지 없음 — ${dto.cityName}, image_url=null로 저장`,
      );
    }

    const city = this.cityRepo.create({ ...dto, imageUrl });
    const saved = await this.cityRepo.save(city);
    this.logger.log(
      `도시 생성 완료 — cityNum=${saved.cityNum} name=${saved.cityName}`,
    );
    return saved;
  }
}
