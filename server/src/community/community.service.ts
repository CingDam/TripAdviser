import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Community } from './entities/community.entity';
import { Comment } from './entities/comment.entity';
import { CommunityLike } from './entities/community-like.entity';
import { CommunityImage } from './entities/community-image.entity';
import { Plan } from '../plan/entities/plan.entity';
import { DayPlan } from '../plan/entities/day-plan.entity';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { S3Service } from '../common/s3.service';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepo: Repository<Community>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(CommunityLike)
    private readonly likeRepo: Repository<CommunityLike>,
    @InjectRepository(CommunityImage)
    private readonly imageRepo: Repository<CommunityImage>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly s3: S3Service,
  ) {}

  // 첨부하려는 plan이 본인 소유인지 검증 — 남의 일정을 함부로 첨부 못 하게
  private async assertPlanOwnership(
    planNum: number,
    userNum: number,
  ): Promise<void> {
    const plan = await this.planRepo.findOne({
      where: { planNum },
      relations: ['user'],
    });
    if (!plan) throw new NotFoundException('일정을 찾을 수 없습니다');
    if (plan.user.userNum !== userNum)
      throw new ForbiddenException('본인 소유의 일정만 첨부할 수 있습니다');
  }

  // content는 목록에서 200자만 반환 — TEXT 전체를 네트워크로 내보내는 낭비 방지
  private truncateContent(posts: Community[]): Community[] {
    const PREVIEW_LEN = 200;
    return posts.map((p) => ({
      ...p,
      content: p.content.slice(0, PREVIEW_LEN),
    })) as Community[];
  }

  async findAll(
    cityNum?: number,
    page = 1,
    limit = 20,
    keyword?: string,
    sort: 'latest' | 'popular' = 'latest',
  ): Promise<{
    data: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.communityRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .leftJoinAndSelect('c.city', 'city')
      // 좋아요 수를 COUNT JOIN으로 한 번에 가져옴 — N+1 방지
      .loadRelationCountAndMap('c.likeCount', 'c.likes')
      .skip((page - 1) * limit)
      .take(limit);

    if (cityNum) {
      qb.andWhere('city.cityNum = :cityNum', { cityNum });
    }

    // 제목·본문·작성자명 모두 검색 — LIKE는 인덱스 미사용이지만 커뮤니티 규모에선 충분
    if (keyword?.trim()) {
      qb.andWhere(
        '(c.title LIKE :kw OR c.content LIKE :kw OR user.name LIKE :kw)',
        { kw: `%${keyword.trim()}%` },
      );
    }

    // 인기순: 좋아요 수 DESC 후 최신순 보조 정렬
    if (sort === 'popular') {
      qb.addSelect(
        (sub) =>
          sub
            .select('COUNT(l.like_num)')
            .from('tb_community_like', 'l')
            .where('l.community_num = c.community_num'),
        'likeCountSort',
      ).orderBy('likeCountSort', 'DESC').addOrderBy('c.createdAt', 'DESC');
    } else {
      qb.orderBy('c.createdAt', 'DESC');
    }

    const [raw, total] = await qb.getManyAndCount();
    return { data: this.truncateContent(raw), total, page, limit };
  }

  async findOne(communityNum: number): Promise<Community> {
    const post = await this.communityRepo.findOne({
      where: { communityNum },
      // plan·plan.city·plan.dayPlans까지 함께 로드 — 상세 페이지에서 일정 카드를 펼쳐 보여줌
      relations: [
        'user',
        'city',
        'images',
        'plan',
        'plan.city',
        'plan.dayPlans',
      ],
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');

    // dayPlans는 planDate→sortOrder 순으로 정렬해 반환 — 클라이언트가 그대로 렌더 가능하게
    if (post.plan?.dayPlans?.length) {
      post.plan.dayPlans.sort((a, b) => {
        if (a.planDate !== b.planDate) return a.planDate < b.planDate ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });
    }

    // 조회수 증가 — increment()로 원자적 업데이트
    await this.communityRepo.increment({ communityNum }, 'viewCount', 1);
    post.viewCount += 1;
    return post;
  }

  async create(userNum: number, dto: CreateCommunityDto): Promise<Community> {
    if (dto.planNum) await this.assertPlanOwnership(dto.planNum, userNum);

    const post = this.communityRepo.create({
      user: { userNum },
      city: dto.cityNum ? { cityNum: dto.cityNum } : null,
      plan: dto.planNum ? { planNum: dto.planNum } : null,
      title: dto.title,
      content: dto.content,
    });
    return this.communityRepo.save(post);
  }

  async update(
    communityNum: number,
    userNum: number,
    dto: UpdateCommunityDto,
  ): Promise<Community> {
    const post = await this.communityRepo.findOne({
      where: { communityNum },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');
    if (post.user.userNum !== userNum)
      throw new ForbiddenException('수정 권한이 없습니다');

    // planNum이 number면 새로 첨부(소유 검증), null이면 첨부 해제, undefined면 변경 없음
    if (typeof dto.planNum === 'number') {
      await this.assertPlanOwnership(dto.planNum, userNum);
    }

    Object.assign(post, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.cityNum !== undefined && { city: { cityNum: dto.cityNum } }),
      ...(dto.planNum !== undefined && {
        plan: typeof dto.planNum === 'number' ? { planNum: dto.planNum } : null,
      }),
    });
    return this.communityRepo.save(post);
  }

  async remove(communityNum: number, userNum: number): Promise<void> {
    const post = await this.communityRepo.findOne({
      where: { communityNum },
      relations: ['user', 'images'],
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');
    if (post.user.userNum !== userNum)
      throw new ForbiddenException('삭제 권한이 없습니다');

    // S3 이미지 먼저 삭제 — DB CASCADE 전에 처리해야 key 목록을 알 수 있음
    if (post.images?.length) {
      const keys = post.images.map((img) => this.s3.urlToKey(img.imageUrl));
      await Promise.allSettled(keys.map((key) => this.s3.deleteFile(key)));
    }

    await this.communityRepo.remove(post);
  }

  // ── 좋아요 ──────────────────────────────────────────────────

  async toggleLike(
    communityNum: number,
    userNum: number,
  ): Promise<{ liked: boolean }> {
    const existing = await this.likeRepo.findOne({
      where: { community: { communityNum }, user: { userNum } },
    });

    if (existing) {
      await this.likeRepo.remove(existing);
      return { liked: false };
    }

    const post = await this.communityRepo.findOne({ where: { communityNum } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');

    const like = this.likeRepo.create({
      community: { communityNum },
      user: { userNum },
    });
    await this.likeRepo.save(like);
    return { liked: true };
  }

  async getLikeCount(communityNum: number): Promise<{ count: number }> {
    const count = await this.likeRepo.count({
      where: { community: { communityNum } },
    });
    return { count };
  }

  // ── 댓글 ────────────────────────────────────────────────────

  async findComments(communityNum: number): Promise<Comment[]> {
    // 최상위 댓글만 조회 후 replies(대댓글) relation으로 한 번에 로드
    return this.commentRepo.find({
      // IsNull() — TypeORM where절에서 NULL 조건은 null 직접 할당 불가, IsNull() 사용 필요
      where: { community: { communityNum }, parent: IsNull() },
      relations: ['user', 'replies', 'replies.user'],
      order: { createdAt: 'ASC' },
    });
  }

  async createComment(
    communityNum: number,
    userNum: number,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    const post = await this.communityRepo.findOne({ where: { communityNum } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');

    // 대댓글이면 부모 댓글 존재 여부 확인
    if (dto.parentCommentNum) {
      const parent = await this.commentRepo.findOne({
        where: { commentNum: dto.parentCommentNum },
      });
      if (!parent) throw new NotFoundException('부모 댓글을 찾을 수 없습니다');
    }

    const comment = this.commentRepo.create({
      community: { communityNum },
      user: { userNum },
      parent: dto.parentCommentNum
        ? { commentNum: dto.parentCommentNum }
        : null,
      content: dto.content,
    });
    return this.commentRepo.save(comment);
  }

  // ── 이미지 ────────────────────────────────────────────────────

  // imageUrls: S3 업로드 후 반환된 public URL 배열
  async saveImages(
    communityNum: number,
    imageUrls: string[],
  ): Promise<CommunityImage[]> {
    const post = await this.communityRepo.findOne({ where: { communityNum } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');

    const images = imageUrls.map((url) =>
      this.imageRepo.create({ community: { communityNum }, imageUrl: url }),
    );
    return this.imageRepo.save(images);
  }

  async updateComment(
    commentNum: number,
    userNum: number,
    content: string,
  ): Promise<Comment> {
    const comment = await this.commentRepo.findOne({
      where: { commentNum },
      relations: ['user'],
    });
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다');
    if (comment.user.userNum !== userNum)
      throw new ForbiddenException('수정 권한이 없습니다');
    comment.content = content;
    return this.commentRepo.save(comment);
  }

  async removeComment(commentNum: number, userNum: number): Promise<void> {
    const comment = await this.commentRepo.findOne({
      where: { commentNum },
      relations: ['user'],
    });
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다');
    if (comment.user.userNum !== userNum)
      throw new ForbiddenException('삭제 권한이 없습니다');
    await this.commentRepo.remove(comment);
  }

  // ── 일정 복제 ──────────────────────────────────────────────────

  // 게시글에 첨부된 plan을 현재 사용자 소유로 깊은 복사
  // 가져간 사용자가 자유롭게 수정해도 원본·다른 가져간 일정에 영향 없도록 독립된 새 plan 생성
  async clonePlan(
    communityNum: number,
    userNum: number,
  ): Promise<{ planNum: number }> {
    const post = await this.communityRepo.findOne({
      where: { communityNum },
      relations: ['plan', 'plan.city', 'plan.dayPlans'],
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');
    if (!post.plan) throw new NotFoundException('첨부된 일정이 없습니다');

    const source = post.plan;

    return this.planRepo.manager.transaction(async (em) => {
      const newPlan = em.create(Plan, {
        user: { userNum },
        city: source.city ? { cityNum: source.city.cityNum } : null,
        // 원본 제목 끝에 "(복사본)" 표시 — 사용자가 자기 일정 목록에서 구분 가능
        planName: `${source.planName} (복사본)`,
        startDate: source.startDate,
        endDate: source.endDate,
        // 가져온 일정은 항상 비공개로 시작 — 본인이 다시 공개 토글
        isPublic: 0,
      });
      const savedPlan = await em.save(Plan, newPlan);

      if (source.dayPlans?.length) {
        const cloned = source.dayPlans.map((dp) =>
          em.create(DayPlan, {
            plan: savedPlan,
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

      return { planNum: savedPlan.planNum };
    });
  }
}
