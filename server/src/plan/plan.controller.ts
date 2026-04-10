import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlanService } from './plan.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

interface AuthRequest {
  user: { userNum: number };
}

@Controller('plan')
@UseGuards(AuthGuard('jwt'))
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  // GET /api/plan — 내 일정 목록
  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.planService.findAllByUser(req.user.userNum);
  }

  // GET /api/plan/:id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.planService.findOne(id, req.user.userNum);
  }

  // POST /api/plan
  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreatePlanDto) {
    return this.planService.create(req.user.userNum, dto);
  }

  // PATCH /api/plan/:id
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.planService.update(id, req.user.userNum, dto);
  }

  // DELETE /api/plan/:id
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.planService.remove(id, req.user.userNum);
  }
}
