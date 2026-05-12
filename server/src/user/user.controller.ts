import {
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { S3Service } from '../common/s3.service';
import { UpdateUserDto } from './dto/update-user.dto';

interface AuthRequest {
  user: { userNum: number };
}

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly s3Service: S3Service,
  ) {}

  // GET /api/user/me — 로그인한 사용자 프로필 조회
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: AuthRequest) {
    return this.userService.findOne(req.user.userNum);
  }

  // PATCH /api/user/me — 닉네임·프로필 이미지 수정
  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('profileImg', {
      fileFilter: (_, file, cb) => {
        cb(null, file.mimetype.startsWith('image/'));
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async updateMe(
    @Req() req: AuthRequest,
    @Body() dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let profileImgUrl: string | undefined;
    if (file) {
      profileImgUrl = await this.s3Service.uploadFile(file, 'profile');
    }
    return this.userService.update(req.user.userNum, dto, profileImgUrl);
  }
}
