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
  Query,
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
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  // GET /api/plan/public — 공개 일정 목록 (인증 불필요)
  // ":id" 보다 앞에 선언해야 'public'이 id로 파싱되지 않음
  @Get('public')
  findPublic(
    @Query('sort') sort?: string,
    @Query('limit') limitStr?: string,
    @Query('cityNum') cityNumStr?: string,
  ) {
    const sortMode: 'latest' | 'places' = sort === 'places' ? 'places' : 'latest';
    const limit = limitStr ? Math.min(50, Math.max(1, Number(limitStr))) : 20;
    const cityNum = cityNumStr ? Number(cityNumStr) : undefined;
    return this.planService.findPublic(sortMode, limit, cityNum);
  }

  // GET /api/plan/public/:id — 읽기전용 단건 (인증 불필요)
  @Get('public/:id')
  findOnePublic(@Param('id', ParseIntPipe) id: number) {
    return this.planService.findOnePublic(id);
  }

  // GET /api/plan — 내 일정 목록
  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Req() req: AuthRequest) {
    return this.planService.findAllByUser(req.user.userNum);
  }

  // GET /api/plan/:id
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.planService.findOne(id, req.user.userNum);
  }

  // POST /api/plan/:id/clone — 공개 일정을 내 일정으로 복제
  @Post(':id/clone')
  @UseGuards(AuthGuard('jwt'))
  clone(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.planService.clone(id, req.user.userNum);
  }

  // POST /api/plan — 플랜 헤더만 생성 (기존 단순 생성)
  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req: AuthRequest, @Body() dto: CreatePlanDto) {
    return this.planService.create(req.user.userNum, dto);
  }

  // POST /api/plan/full — 플랜 헤더 + 전체 dayPlans를 트랜잭션으로 한 번에 저장
  @Post('full')
  @UseGuards(AuthGuard('jwt'))
  saveFull(@Req() req: AuthRequest, @Body() dto: SavePlanDto) {
    return this.planService.saveFull(req.user.userNum, dto);
  }

  // PUT /api/plan/:id/full — 기존 일정 수정 (헤더 + dayPlans 전체 교체, 멱등)
  @Put(':id/full')
  @UseGuards(AuthGuard('jwt'))
  updateFull(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body() dto: SavePlanDto,
  ) {
    return this.planService.updateFull(id, req.user.userNum, dto);
  }

  // PATCH /api/plan/:id
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.planService.update(id, req.user.userNum, dto);
  }

  // DELETE /api/plan/:id
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.planService.remove(id, req.user.userNum);
  }
}
