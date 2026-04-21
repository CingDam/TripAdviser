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
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

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
  ) {}

  // content는 목록에서 200자만 반환 — TEXT 전체를 네트워크로 내보내는 낭비 방지
  private truncateContent(posts: Community[]): Community[] {
    const PREVIEW_LEN = 200;
    return posts.map((p) => ({ ...p, content: p.content.slice(0, PREVIEW_LEN) })) as Community[];
  }

  async findAll(
    cityNum?: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: Community[]; total: number; page: number; limit: number }> {
    const qb = this.communityRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .leftJoinAndSelect('c.city', 'city')
      // 좋아요 수를 COUNT JOIN으로 한 번에 가져옴 — N+1 방지
      .loadRelationCountAndMap('c.likeCount', 'c.likes')
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (cityNum) {
      qb.where('city.cityNum = :cityNum', { cityNum });
    }

    const [raw, total] = await qb.getManyAndCount();
    return { data: this.truncateContent(raw), total, page, limit };
  }

  async findOne(communityNum: number): Promise<Community> {
    const post = await this.communityRepo.findOne({
      where: { communityNum },
      relations: ['user', 'city', 'images'],
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');

    // 조회수 증가 — increment()로 원자적 업데이트
    await this.communityRepo.increment({ communityNum }, 'viewCount', 1);
    post.viewCount += 1;
    return post;
  }

  async create(userNum: number, dto: CreateCommunityDto): Promise<Community> {
    const post = this.communityRepo.create({
      user: { userNum },
      city: dto.cityNum ? { cityNum: dto.cityNum } : null,
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

    Object.assign(post, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.cityNum !== undefined && { city: { cityNum: dto.cityNum } }),
    });
    return this.communityRepo.save(post);
  }

  async remove(communityNum: number, userNum: number): Promise<void> {
    const post = await this.communityRepo.findOne({
      where: { communityNum },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');
    if (post.user.userNum !== userNum)
      throw new ForbiddenException('삭제 권한이 없습니다');
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

  // imageUrls: multer가 저장한 파일 경로 배열 — /uploads/community/{filename}
  async saveImages(communityNum: number, imageUrls: string[]): Promise<CommunityImage[]> {
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
}
