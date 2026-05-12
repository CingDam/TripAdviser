import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlaceSearchService } from './place-search.service';

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
}
