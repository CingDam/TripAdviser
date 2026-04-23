import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { CommunityService } from './community.service';
import { S3Service } from '../common/s3.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

interface AuthRequest {
  user: { userNum: number };
}

@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly s3: S3Service,
  ) {}

  // GET /api/community — 게시글 목록 (?cityNum=N&page=1&limit=20)
  @Get()
  findAll(
    @Query('cityNum') cityNumStr?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const cityNum = cityNumStr !== undefined ? Number(cityNumStr) : undefined;
    const page = pageStr !== undefined ? Math.max(1, Number(pageStr)) : 1;
    const limit =
      limitStr !== undefined ? Math.min(50, Math.max(1, Number(limitStr))) : 20;
    return this.communityService.findAll(cityNum, page, limit);
  }

  // GET /api/community/:id — 게시글 상세 (조회수 +1)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.communityService.findOne(id);
  }

  // POST /api/community
  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req: AuthRequest, @Body() dto: CreateCommunityDto) {
    return this.communityService.create(req.user.userNum, dto);
  }

  // PATCH /api/community/:id
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communityService.update(id, req.user.userNum, dto);
  }

  // DELETE /api/community/:id
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.communityService.remove(id, req.user.userNum);
  }

  // ── 이미지 ──────────────────────────────────────────────────

  // POST /api/community/:id/images — 이미지 최대 5장 업로드 (multipart/form-data, field: images)
  @Post(':id/images')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      // 메모리에 올린 뒤 S3로 스트리밍 — 로컬 디스크 의존 없음
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('이미지 파일만 업로드 가능합니다'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
    }),
  )
  async uploadImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const urls = await Promise.all(
      files.map((f) => this.s3.uploadFile(f, 'community')),
    );
    return this.communityService.saveImages(id, urls);
  }

  // ── 좋아요 ──────────────────────────────────────────────────

  // POST /api/community/:id/like — 좋아요 토글
  @Post(':id/like')
  @UseGuards(AuthGuard('jwt'))
  toggleLike(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.communityService.toggleLike(id, req.user.userNum);
  }

  // GET /api/community/:id/like — 좋아요 수 조회
  @Get(':id/like')
  getLikeCount(@Param('id', ParseIntPipe) id: number) {
    return this.communityService.getLikeCount(id);
  }

  // ── 댓글 ────────────────────────────────────────────────────

  // GET /api/community/:id/comments — 댓글 목록 (대댓글 포함)
  @Get(':id/comments')
  findComments(@Param('id', ParseIntPipe) id: number) {
    return this.communityService.findComments(id);
  }

  // POST /api/community/:id/comments
  @Post(':id/comments')
  @UseGuards(AuthGuard('jwt'))
  createComment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.createComment(id, req.user.userNum, dto);
  }

  // PATCH /api/community/:id/comments/:commentId
  @Patch(':id/comments/:commentId')
  @UseGuards(AuthGuard('jwt'))
  updateComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() req: AuthRequest,
    @Body('content') content: string,
  ) {
    return this.communityService.updateComment(
      commentId,
      req.user.userNum,
      content,
    );
  }

  // DELETE /api/community/:id/comments/:commentId
  @Delete(':id/comments/:commentId')
  @UseGuards(AuthGuard('jwt'))
  removeComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() req: AuthRequest,
  ) {
    return this.communityService.removeComment(commentId, req.user.userNum);
  }
}
