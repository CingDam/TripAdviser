import { Module } from '@nestjs/common';
import { PlaceSearchController } from './place-search.controller';
import { PlaceSearchService } from './place-search.service';

@Module({
  controllers: [PlaceSearchController],
  providers: [PlaceSearchService],
})
export class PlaceSearchModule {}
