import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlanService } from './plan.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { SavePlanDto } from './dto/save-plan.dto';

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

  // POST /api/plan — 플랜 헤더만 생성 (기존 단순 생성)
  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreatePlanDto) {
    return this.planService.create(req.user.userNum, dto);
  }

  // POST /api/plan/full — 플랜 헤더 + 전체 dayPlans를 트랜잭션으로 한 번에 저장
  @Post('full')
  saveFull(@Req() req: AuthRequest, @Body() dto: SavePlanDto) {
    return this.planService.saveFull(req.user.userNum, dto);
  }

  // PUT /api/plan/:id/full — 기존 일정 수정 (헤더 + dayPlans 전체 교체, 멱등)
  @Put(':id/full')
  updateFull(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body() dto: SavePlanDto,
  ) {
    return this.planService.updateFull(id, req.user.userNum, dto);
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
