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
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

interface AuthRequest {
  user: { userNum: number };
}

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // GET /api/community — 게시글 목록
  @Get()
  findAll() {
    return this.communityService.findAll();
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
