import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { DayPlan } from './entities/day-plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { SavePlanDto } from './dto/save-plan.dto';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(DayPlan)
    private readonly dayPlanRepo: Repository<DayPlan>,
  ) {}

  findAllByUser(userNum: number): Promise<Plan[]> {
    return this.planRepo.find({
      where: { user: { userNum } },
      relations: ['city', 'dayPlans'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(planNum: number, userNum: number): Promise<Plan> {
    const plan = await this.planRepo.findOne({
      where: { planNum },
      // user를 함께 로드해야 소유자 검사(plan.user.userNum)가 가능
      relations: ['user', 'city', 'dayPlans'],
    });
    if (!plan) throw new NotFoundException('일정을 찾을 수 없습니다');
    if (plan.user.userNum !== userNum && !plan.isPublic) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }
    return plan;
  }

  async create(userNum: number, dto: CreatePlanDto): Promise<Plan> {
    const plan = this.planRepo.create({
      user: { userNum },
      city: dto.cityNum ? { cityNum: dto.cityNum } : null,
      planName: dto.planName,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
    });
    return this.planRepo.save(plan);
  }

  async update(
    planNum: number,
    userNum: number,
    dto: UpdatePlanDto,
  ): Promise<Plan> {
    const plan = await this.planRepo.findOne({
      where: { planNum },
      relations: ['user'],
    });
    if (!plan) throw new NotFoundException('일정을 찾을 수 없습니다');
    if (plan.user.userNum !== userNum)
      throw new ForbiddenException('수정 권한이 없습니다');

    Object.assign(plan, {
      ...(dto.planName !== undefined && { planName: dto.planName }),
      ...(dto.cityNum !== undefined && { city: { cityNum: dto.cityNum } }),
      ...(dto.startDate !== undefined && { startDate: dto.startDate }),
      ...(dto.endDate !== undefined && { endDate: dto.endDate }),
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
    });
    return this.planRepo.save(plan);
  }

  async remove(planNum: number, userNum: number): Promise<void> {
    const plan = await this.planRepo.findOne({
      where: { planNum },
      relations: ['user'],
    });
    if (!plan) throw new NotFoundException('일정을 찾을 수 없습니다');
    if (plan.user.userNum !== userNum)
      throw new ForbiddenException('삭제 권한이 없습니다');
    await this.planRepo.remove(plan);
  }

  // 기존 일정 수정 — 헤더 업데이트 + 기존 dayPlans 전체 교체 (트랜잭션)
  async updateFull(
    planNum: number,
    userNum: number,
    dto: SavePlanDto,
  ): Promise<Plan> {
    return this.planRepo.manager.transaction(async (em) => {
      const plan = await em.findOne(Plan, {
        where: { planNum },
        relations: ['user'],
      });
      if (!plan) throw new NotFoundException('일정을 찾을 수 없습니다');
      if (plan.user.userNum !== userNum)
        throw new ForbiddenException('수정 권한이 없습니다');

      // 플랜 헤더 업데이트
      plan.planName = dto.planName;
      if (dto.startDate !== undefined) plan.startDate = dto.startDate ?? null;
      if (dto.endDate !== undefined) plan.endDate = dto.endDate ?? null;
      if (dto.isPublic !== undefined) plan.isPublic = dto.isPublic ? 1 : 0;
      const savedPlan = await em.save(Plan, plan);

      // 기존 dayPlans 전체 삭제 후 새 항목 삽입
      await em.delete(DayPlan, { plan: { planNum } });
      if (dto.dayPlans.length > 0) {
        const entities = dto.dayPlans.map((item) =>
          em.create(DayPlan, {
            plan: savedPlan,
            planDate: item.planDate,
            sortOrder: item.sortOrder,
            placeId: item.placeId ?? null,
            locationName: item.locationName ?? null,
            address: item.address ?? null,
            lat: item.lat ?? null,
            lng: item.lng ?? null,
            tel: item.tel ?? null,
          }),
        );
        await em.save(DayPlan, entities);
      }

      return savedPlan;
    });
  }

  // 플랜 헤더 + 전체 dayPlans를 트랜잭션으로 한 번에 저장
  async saveFull(userNum: number, dto: SavePlanDto): Promise<Plan> {
    return this.planRepo.manager.transaction(async (em) => {
      const plan = em.create(Plan, {
        user: { userNum },
        city: dto.cityNum ? { cityNum: dto.cityNum } : null,
        planName: dto.planName,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        isPublic: dto.isPublic ? 1 : 0,
      });
      const savedPlan = await em.save(Plan, plan);

      if (dto.dayPlans.length > 0) {
        const dayPlanEntities = dto.dayPlans.map((item) =>
          em.create(DayPlan, {
            plan: savedPlan,
            planDate: item.planDate,
            sortOrder: item.sortOrder,
            placeId: item.placeId ?? null,
            locationName: item.locationName ?? null,
            address: item.address ?? null,
            lat: item.lat ?? null,
            lng: item.lng ?? null,
            tel: item.tel ?? null,
          }),
        );
        await em.save(DayPlan, dayPlanEntities);
      }

      return savedPlan;
    });
  }
}
