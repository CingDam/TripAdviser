import {
  Body,
  Controller,
  Delete,
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
import { CreateRoomDto } from './dto/create-room.dto';

interface AuthRequest {
  user: { userNum: number };
}

@Controller('chat/rooms')
export class ChatRoomController {
  constructor(private readonly chatRoomService: ChatRoomService) {}

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
}
