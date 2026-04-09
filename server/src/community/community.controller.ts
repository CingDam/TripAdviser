import { Controller, Get } from '@nestjs/common';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // GET /api/community
  @Get()
  findAll() {
    return this.communityService.findAll();
  }
}
