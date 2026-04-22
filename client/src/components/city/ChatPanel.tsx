'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Send, Users, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { nestApi } from '@/config/api.config';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import Button from '@/components/common/Button';

const NEST_URL = process.env.NEXT_PUBLIC_NEST_URL ?? 'http://localhost:3001';

interface ChatRoom {
  roomNum: number;
  roomName: string;
  memberCount: number;
  createdAt: string;
}

interface Message {
  _id: string;
  roomNum: number;
  userNum: number;
  senderName: string;
  senderProfile: string | null;
  content: string;
  createdAt: string;
}

interface Props {
  cityNum: number;
  cityName: string;
}

// ── 채팅방 목록 ────────────────────────────────────────────────────────────

function RoomList({
  cityNum,
  cityName,
  onEnter,
}: {
  cityNum: number;
  cityName: string;
  onEnter: (room: ChatRoom) => void;
}) {
  const { token } = useAuthStore();
  const { show } = useSnackbar();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    void loadRooms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityNum]);

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const res = await nestApi.get<ChatRoom[]>(`/chat/rooms?cityNum=${cityNum}`);
      setRooms(res.data);
    } catch {
      show('채팅방 목록을 불러오지 못했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    setIsCreating(true);
    try {
      await nestApi.post('/chat/rooms', { roomName: roomName.trim(), cityNum });
      show('채팅방이 생성되었습니다', 'success');
      setIsModalOpen(false);
      setRoomName('');
      void loadRooms();
    } catch {
      show('채팅방 생성에 실패했습니다', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative flex flex-col h-[600px] bg-white dark:bg-[#2c2c2e] rounded-3xl border border-gray-100 dark:border-white/8 shadow-sm overflow-hidden">

      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/8 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white/90">
            {cityName} 채팅방
          </h3>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
            방을 만들거나 입장하세요
          </p>
        </div>
        {token && (
          <Button variant="primary" onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 !py-1.5 !px-3 !text-xs">
            <Plus size={13} />
            방 만들기
          </Button>
        )}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {isLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 w-full rounded-2xl" />
            ))}
          </>
        )}

        {!isLoading && rooms.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 dark:text-white/20 gap-2 py-16">
            <Users size={36} strokeWidth={1.5} />
            <p className="text-sm">아직 채팅방이 없습니다</p>
            {token && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer mt-1"
              >
                첫 번째 방을 만들어보세요
              </button>
            )}
          </div>
        )}

        {rooms.map((room) => (
          <button
            key={room.roomNum}
            onClick={() => onEnter(room)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/20 transition-all group cursor-pointer text-left"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-semibold text-gray-800 dark:text-white/80 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                {room.roomName}
              </span>
              <span className="text-xs text-gray-400 dark:text-white/30">
                {new Date(room.createdAt).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/30 flex-shrink-0 ml-3">
              <Users size={12} />
              {room.memberCount}
            </span>
          </button>
        ))}
      </div>

      {/* 방 만들기 모달 */}
      {isModalOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm rounded-3xl">
          <div className="w-full max-w-sm bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 flex flex-col gap-4 shadow-2xl border border-gray-100 dark:border-white/8">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white/90">새 채팅방 만들기</h4>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 dark:text-white/30 dark:hover:text-white/70 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
              placeholder="채팅방 이름을 입력하세요"
              maxLength={100}
              autoFocus
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>취소</Button>
              <Button variant="primary" onClick={() => void handleCreate()} disabled={!roomName.trim() || isCreating}>
                {isCreating ? '생성 중...' : '만들기'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 채팅 화면 ──────────────────────────────────────────────────────────────

function ChatRoom({
  room,
  onBack,
}: {
  room: ChatRoom;
  onBack: () => void;
}) {
  const { userNum, userName, token } = useAuthStore();
  const { show } = useSnackbar();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 입장 API 호출 (멤버 등록)
    if (token) {
      void nestApi.post(`/chat/rooms/${room.roomNum}/join`).catch(() => {});
    }

    const socket = io(NEST_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinRoom', {
        roomNum: room.roomNum,
        userNum: userNum ?? 0,
        senderName: userName ?? '익명',
        senderProfile: null,
      });
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('messageHistory', (history: Message[]) => setMessages(history));
    socket.on('newMessage', (msg: Message) => setMessages((prev) => [...prev, msg]));

    return () => {
      socket.emit('leaveRoom', { roomNum: room.roomNum });
      socket.disconnect();
    };
  // room.roomNum이 바뀔 때만 재연결
  }, [room.roomNum, userNum, userName, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!token) {
      show('로그인 후 채팅에 참여할 수 있습니다', 'warning');
      return;
    }
    const trimmed = input.trim();
    if (!trimmed || !socketRef.current) return;

    socketRef.current.emit('sendMessage', {
      roomNum: room.roomNum,
      userNum: userNum ?? 0,
      senderName: userName ?? '익명',
      senderProfile: null,
      content: trimmed,
    });
    setInput('');
  };

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-[#2c2c2e] rounded-3xl border border-gray-100 dark:border-white/8 shadow-sm overflow-hidden">

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-white/8 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-white/30 dark:hover:text-white/70 dark:hover:bg-white/8 transition-all flex-shrink-0 cursor-pointer"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white/90 truncate">{room.roomName}</p>
          <p className="text-xs text-gray-400 dark:text-white/30">{room.memberCount}명 참여 중</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium flex-shrink-0 ${
          connected ? 'text-emerald-500' : 'text-gray-300 dark:text-white/20'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'}`} />
          {connected ? '연결됨' : '연결 중...'}
        </span>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 dark:text-white/20 gap-2 py-16">
            <p className="text-sm">아직 대화가 없습니다</p>
            <p className="text-xs">첫 번째 메시지를 보내보세요</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.userNum === userNum;
          return (
            <div key={msg._id} className={`flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
              {!isMine && (
                <span className="text-xs text-gray-400 dark:text-white/30 px-1">{msg.senderName}</span>
              )}
              <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                isMine
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-100 dark:bg-white/8 text-gray-800 dark:text-white/80 rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-300 dark:text-white/20 px-1">
                {new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-white/8 flex-shrink-0">
        {token ? (
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#1c1c1e] rounded-2xl px-4 py-2.5 border border-gray-200 dark:border-white/8 focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="메시지를 입력하세요..."
              maxLength={500}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center text-white disabled:opacity-30 hover:bg-indigo-700 transition-colors cursor-pointer disabled:cursor-default flex-shrink-0"
            >
              <Send size={13} />
            </button>
          </div>
        ) : (
          <p className="text-xs text-center text-gray-400 dark:text-white/30 py-1">
            채팅에 참여하려면 로그인이 필요합니다
          </p>
        )}
      </div>
    </div>
  );
}

// ── 외부 export — 목록 ↔ 채팅 전환 ─────────────────────────────────────────

export default function ChatPanel({ cityNum, cityName }: Props) {
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);

  if (activeRoom) {
    return <ChatRoom room={activeRoom} onBack={() => setActiveRoom(null)} />;
  }

  return <RoomList cityNum={cityNum} cityName={cityName} onEnter={setActiveRoom} />;
}
