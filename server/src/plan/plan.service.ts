import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { DayPlan } from './entities/day-plan.entity';
import { City } from '../city/entities/city.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { SavePlanDto } from './dto/save-plan.dto';
import { PexelsService } from '../city/pexels.service';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(DayPlan)
    private readonly dayPlanRepo: Repository<DayPlan>,
    private readonly pexels: PexelsService,
  ) {}

  // cityNum이 있으면 그대로 사용, 없으면 cityName+country로 도시를 조회하고 없으면 새로 생성
  private async resolveCity(
    em: EntityManager,
    dto: SavePlanDto,
  ): Promise<{ cityNum: number } | null> {
    if (dto.cityNum) return { cityNum: dto.cityNum };

    if (!dto.cityName || !dto.country) return null;

    const existing = await em.findOne(City, {
      where: { cityName: dto.cityName, country: dto.country },
    });
    if (existing) return { cityNum: existing.cityNum };

    const imageUrl = await this.pexels.fetchCityImageUrl(
      dto.cityName,
      dto.country,
    );

    const created = await em.save(
      City,
      em.create(City, {
        cityName: dto.cityName,
        country: dto.country,
        lat: dto.cityLat ?? 0,
        lng: dto.cityLng ?? 0,
        imageUrl,
      }),
    );
    return { cityNum: created.cityNum };
  }

  findAllByUser(userNum: number): Promise<Plan[]> {
    return this.planRepo.find({
      where: { user: { userNum } },
      relations: ['city', 'dayPlans'],
      order: { updatedAt: 'DESC' },
    });
  }

  // 공개 일정 목록 — is_public=1인 플랜을 저장순(최신) 또는 장소수순으로 반환
  async findPublic(
    sort: 'latest' | 'places' = 'latest',
    limit = 20,
    cityNum?: number,
  ): Promise<Plan[]> {
    const qb = this.planRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.city', 'city')
      .leftJoinAndSelect('p.user', 'user')
      .leftJoinAndSelect('p.dayPlans', 'dayPlans')
      .where('p.is_public = 1')
      .take(limit);

    if (cityNum) {
      qb.andWhere('city.cityNum = :cityNum', { cityNum });
    }

    if (sort === 'places') {
      // alias 기반 orderBy는 TypeORM이 컬럼 메타를 찾지 못해 런타임 오류 발생 — 서브쿼리 인라인 사용
      qb.orderBy(
        '(SELECT COUNT(dp.day_plan_num) FROM tb_day_plan dp WHERE dp.plan_num = p.plan_num)',
        'DESC',
      ).addOrderBy('p.updatedAt', 'DESC');
    } else {
      qb.orderBy('p.updatedAt', 'DESC');
    }

    return qb.getMany();
  }

  // 읽기전용 단건 조회 — 공개 일정이면 누구나 접근 가능
  async findOnePublic(planNum: number): Promise<Plan> {
    const plan = await this.planRepo.findOne({
      where: { planNum },
      relations: ['user', 'city', 'dayPlans'],
    });
    if (!plan) throw new NotFoundException('일정을 찾을 수 없습니다');
    if (!plan.isPublic) throw new ForbiddenException('비공개 일정입니다');

    // dayPlans 날짜·순서 정렬
    plan.dayPlans.sort((a, b) => {
      if (a.planDate !== b.planDate) return a.planDate < b.planDate ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
    return plan;
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
      relations: ['user', 'city'],
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
      const cityRef = await this.resolveCity(em, dto);
      plan.city = cityRef ? ({ cityNum: cityRef.cityNum } as City) : null;
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

      this.logger.log(
        `일정 수정 — plan:${savedPlan.planNum} user:${userNum} (${dto.dayPlans.length}개 장소)`,
      );
      return savedPlan;
    });
  }

  // 공개 일정을 내 일정으로 깊은 복사 — 원본과 독립된 새 plan 생성
  async clone(planNum: number, userNum: number): Promise<{ planNum: number }> {
    const source = await this.planRepo.findOne({
      where: { planNum },
      relations: ['city', 'dayPlans'],
    });
    if (!source) throw new NotFoundException('일정을 찾을 수 없습니다');
    if (!source.isPublic) throw new ForbiddenException('비공개 일정입니다');

    return this.planRepo.manager.transaction(async (em) => {
      const newPlan = em.create(Plan, {
        user: { userNum },
        city: source.city ? { cityNum: source.city.cityNum } : null,
        // 원본 제목 끝에 "(복사본)" — 내 일정 목록에서 구분 가능하도록
        planName: `${source.planName} (복사본)`,
        startDate: source.startDate,
        endDate: source.endDate,
        // 가져온 일정은 비공개로 시작 — 본인이 다시 공개 토글
        isPublic: 0,
      });
      const saved = await em.save(Plan, newPlan);

      if (source.dayPlans?.length) {
        const cloned = source.dayPlans.map((dp) =>
          em.create(DayPlan, {
            plan: saved,
            planDate: dp.planDate,
            sortOrder: dp.sortOrder,
            placeId: dp.placeId,
            locationName: dp.locationName,
            address: dp.address,
            lat: dp.lat,
            lng: dp.lng,
            tel: dp.tel,
          }),
        );
        await em.save(DayPlan, cloned);
      }

      this.logger.log(
        `일정 복제 — source:${planNum} → new:${saved.planNum} user:${userNum}`,
      );
      return { planNum: saved.planNum };
    });
  }

  // 플랜 헤더 + 전체 dayPlans를 트랜잭션으로 한 번에 저장
  async saveFull(userNum: number, dto: SavePlanDto): Promise<Plan> {
    return this.planRepo.manager.transaction(async (em) => {
      const cityRef = await this.resolveCity(em, dto);
      const plan = em.create(Plan, {
        user: { userNum },
        city: cityRef,
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

      this.logger.log(
        `일정 저장 — plan:${savedPlan.planNum} user:${userNum} (${dto.dayPlans.length}개 장소)`,
      );
      return savedPlan;
    });
  }
}
