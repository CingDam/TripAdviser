import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoomDto } from './dto/create-room.dto';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatRoomMember } from './entities/chat-room-member.entity';

@Injectable()
export class ChatRoomService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly roomRepo: Repository<ChatRoom>,
    @InjectRepository(ChatRoomMember)
    private readonly memberRepo: Repository<ChatRoomMember>,
  ) {}

  // 도시별 채팅방 목록 — 멤버 수 포함
  async getRoomsByCity(cityNum: number) {
    const rooms = await this.roomRepo.find({
      where: { cityNum },
      relations: ['members'],
      order: { createdAt: 'DESC' },
    });

    return rooms.map((room) => ({
      roomNum: room.roomNum,
      roomName: room.roomName,
      roomType: room.roomType,
      memberCount: room.members.length,
      createdAt: room.createdAt,
    }));
  }

  // 채팅방 생성 + 생성자 자동 입장
  async createRoom(userNum: number, dto: CreateRoomDto): Promise<ChatRoom> {
    return this.roomRepo.manager.transaction(async (em) => {
      const room = await em.save(
        ChatRoom,
        em.create(ChatRoom, {
          roomName: dto.roomName,
          cityNum: dto.cityNum ?? null,
          roomType: 'open',
        }),
      );

      await em.save(
        ChatRoomMember,
        em.create(ChatRoomMember, {
          room: { roomNum: room.roomNum },
          user: { userNum },
        }),
      );

      return room;
    });
  }

  // 채팅방 입장 — 이미 멤버면 무시
  async joinRoom(userNum: number, roomNum: number): Promise<void> {
    const room = await this.roomRepo.findOne({ where: { roomNum } });
    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다');

    const existing = await this.memberRepo.findOne({
      where: { room: { roomNum }, user: { userNum } },
    });
    if (existing) return;

    await this.memberRepo.save(
      this.memberRepo.create({
        room: { roomNum },
        user: { userNum },
      }),
    );
  }

  // 채팅방 퇴장
  async leaveRoom(userNum: number, roomNum: number): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { room: { roomNum }, user: { userNum } },
    });
    if (!member) throw new BadRequestException('채팅방 멤버가 아닙니다');
    await this.memberRepo.remove(member);
  }

  // 내가 참여 중인 채팅방 목록
  async getMyRooms(userNum: number) {
    const members = await this.memberRepo.find({
      where: { user: { userNum } },
      relations: ['room', 'room.members'],
    });

    return members.map(({ room }) => ({
      roomNum: room.roomNum,
      roomName: room.roomName,
      memberCount: room.members.length,
      createdAt: room.createdAt,
    }));
  }
}
