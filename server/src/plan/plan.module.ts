import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { DayPlan } from './entities/day-plan.entity';
import { City } from '../city/entities/city.entity';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [TypeOrmModule.forFeature([Plan, DayPlan, City])],
  controllers: [PlanController],
  providers: [PlanService],
})
export class PlanModule {}
