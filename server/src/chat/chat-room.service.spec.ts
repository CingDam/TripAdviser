import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatRoomService } from './chat-room.service';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatRoomMember } from './entities/chat-room-member.entity';
import { Message } from './schemas/message.schema';

const mockRoomRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  manager: { transaction: jest.fn() },
});

const mockMemberRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

const mockMessageModel = () => ({
  aggregate: jest
    .fn()
    .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
});

describe('ChatRoomService', () => {
  let service: ChatRoomService;
  let memberRepo: ReturnType<typeof mockMemberRepo>;
  let roomRepo: ReturnType<typeof mockRoomRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatRoomService,
        { provide: getRepositoryToken(ChatRoom), useFactory: mockRoomRepo },
        {
          provide: getRepositoryToken(ChatRoomMember),
          useFactory: mockMemberRepo,
        },
        { provide: getModelToken(Message.name), useFactory: mockMessageModel },
      ],
    }).compile();

    service = module.get<ChatRoomService>(ChatRoomService);
    memberRepo = module.get(getRepositoryToken(ChatRoomMember));
    roomRepo = module.get(getRepositoryToken(ChatRoom));
  });

  describe('isMember', () => {
    it('멤버이면 true를 반환한다', async () => {
      memberRepo.findOne.mockResolvedValue({ memberNum: 1 });
      const result = await service.isMember(1, 1);
      expect(result).toBe(true);
    });

    it('비멤버이면 false를 반환한다', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      const result = await service.isMember(99, 1);
      expect(result).toBe(false);
    });
  });

  describe('joinRoom', () => {
    it('존재하지 않는 방에 입장하면 NotFoundException을 던진다', async () => {
      roomRepo.findOne.mockResolvedValue(null);
      await expect(service.joinRoom(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('이미 멤버이면 중복 저장 없이 조용히 반환한다', async () => {
      roomRepo.findOne.mockResolvedValue({ roomNum: 1 });
      memberRepo.findOne.mockResolvedValue({ memberNum: 1 });
      await service.joinRoom(1, 1);
      expect(memberRepo.save).not.toHaveBeenCalled();
    });

    it('신규 멤버이면 memberRepo.save를 호출한다', async () => {
      roomRepo.findOne.mockResolvedValue({ roomNum: 1 });
      memberRepo.findOne.mockResolvedValue(null);
      memberRepo.create.mockReturnValue({});
      memberRepo.save.mockResolvedValue({});
      await service.joinRoom(1, 1);
      expect(memberRepo.save).toHaveBeenCalled();
    });
  });

  describe('leaveRoom', () => {
    it('멤버가 아닌 사용자가 퇴장하면 BadRequestException을 던진다', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      await expect(service.leaveRoom(99, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('멤버이면 memberRepo.remove를 호출한다', async () => {
      const member = { memberNum: 1 };
      memberRepo.findOne.mockResolvedValue(member);
      memberRepo.remove.mockResolvedValue(undefined);
      await service.leaveRoom(1, 1);
      expect(memberRepo.remove).toHaveBeenCalledWith(member);
    });
  });
});
