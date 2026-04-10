import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
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
      relations: ['city', 'dayPlans'],
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
}
