import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatRoomService } from './chat-room.service';
import { ChatService } from './chat.service';
import { CreateRoomDto } from './dto/create-room.dto';

interface AuthRequest {
  user: { userNum: number };
}

@Controller('chat/rooms')
export class ChatRoomController {
  constructor(
    private readonly chatRoomService: ChatRoomService,
    private readonly chatService: ChatService,
  ) {}

  @Get()
  getRoomsByCity(@Query('cityNum', ParseIntPipe) cityNum: number) {
    return this.chatRoomService.getRoomsByCity(cityNum);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  createRoom(@Req() req: AuthRequest, @Body() dto: CreateRoomDto) {
    return this.chatRoomService.createRoom(req.user.userNum, dto);
  }

  @Post(':roomNum/join')
  @UseGuards(AuthGuard('jwt'))
  joinRoom(
    @Param('roomNum', ParseIntPipe) roomNum: number,
    @Req() req: AuthRequest,
  ) {
    return this.chatRoomService.joinRoom(req.user.userNum, roomNum);
  }

  @Delete(':roomNum/leave')
  @UseGuards(AuthGuard('jwt'))
  leaveRoom(
    @Param('roomNum', ParseIntPipe) roomNum: number,
    @Req() req: AuthRequest,
  ) {
    return this.chatRoomService.leaveRoom(req.user.userNum, roomNum);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  getMyRooms(@Req() req: AuthRequest) {
    return this.chatRoomService.getMyRooms(req.user.userNum);
  }

  // 이전 메시지 페이지네이션 — JWT 인증 + 멤버십 검증 후 before(_id) 기준 50개 조회
  @Get(':roomNum/messages')
  @UseGuards(AuthGuard('jwt'))
  async getMessages(
    @Param('roomNum', ParseIntPipe) roomNum: number,
    @Req() req: AuthRequest,
    @Query('before') before?: string,
  ) {
    const isMember = await this.chatRoomService.isMember(
      req.user.userNum,
      roomNum,
    );
    if (!isMember) throw new ForbiddenException('채팅방 멤버가 아닙니다');
    return this.chatService.getMessages(roomNum, before);
  }
}
