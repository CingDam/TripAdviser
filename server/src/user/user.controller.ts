import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // GET /api/user/me — 로그인한 사용자 프로필 조회
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: { user: { userNum: number } }) {
    return this.userService.findOne(req.user.userNum);
  }
}
