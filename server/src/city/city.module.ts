import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from './entities/city.entity';
import { CityController } from './city.controller';
import { CityService } from './city.service';
import { PexelsService } from './pexels.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([City]),
    // Pexels API 호출용 — timeout 5s로 제한해 응답 지연 시 도시 생성을 블로킹하지 않음
    HttpModule.register({ timeout: 5_000 }),
  ],
  controllers: [CityController],
  providers: [CityService, PexelsService],
  exports: [PexelsService],
})
export class CityModule {}
