'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, ChevronUp, Plus, Send, Users, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { nestApi } from '@/config/api.config';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import Button from '@/components/common/Button';

const NEST_URL = process.env.NEXT_PUBLIC_NEST_URL ?? 'http://localhost:3001';
// 재연결 최대 시도 횟수 — 초과 시 "새로고침" 안내
const MAX_RECONNECT = 5;

interface ChatRoom {
  roomNum: number;
  roomName: string;
  memberCount: number;
  createdAt: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
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

  function formatLastTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '방금';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  }

  return (
    <div className="relative flex flex-col h-[600px] bg-white dark:bg-[#2c2c2e] rounded-3xl border border-[#DBEAFE]/40 dark:border-white/8 shadow-sm overflow-hidden">

      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#DBEAFE]/40 dark:border-white/8 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-[#0f172a] dark:text-white/90">
            {cityName} 채팅방
          </h3>
          <p className="text-xs text-[#0f172a]/40 dark:text-white/30 mt-0.5">
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
              <div key={i} className="h-16 w-full rounded-2xl bg-[#EFF6FF]/60 dark:bg-white/5 animate-pulse" />
            ))}
          </>
        )}

        {!isLoading && rooms.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-[#0f172a]/20 dark:text-white/20 gap-2 py-16">
            <Users size={36} strokeWidth={1.5} />
            <p className="text-sm">아직 채팅방이 없습니다</p>
            {token && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer mt-1"
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
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#F8FAFF] dark:bg-white/5 hover:bg-[#EFF6FF] dark:hover:bg-[#2563EB]/10 border border-transparent hover:border-[#DBEAFE] dark:hover:border-[#2563EB]/20 transition-all group cursor-pointer text-left"
          >
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-semibold text-[#0f172a] dark:text-white/80 group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors truncate">
                {room.roomName}
              </span>
              {room.lastMessage ? (
                <span className="text-xs text-[#0f172a]/40 dark:text-white/30 truncate">
                  {room.lastMessage}
                </span>
              ) : (
                <span className="text-xs text-[#0f172a]/25 dark:text-white/20">
                  {new Date(room.createdAt).toLocaleDateString('ko-KR')} 생성
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
              {room.lastMessageAt && (
                <span className="text-[10px] text-[#0f172a]/30 dark:text-white/20">
                  {formatLastTime(room.lastMessageAt)}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-[#0f172a]/40 dark:text-white/30">
                <Users size={11} />
                {room.memberCount}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* 방 만들기 모달 */}
      {isModalOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm rounded-3xl">
          <div className="w-full max-w-sm bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 flex flex-col gap-4 shadow-2xl border border-[#DBEAFE]/40 dark:border-white/8">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#0f172a] dark:text-white/90">새 채팅방 만들기</h4>
              <button onClick={() => setIsModalOpen(false)} className="text-[#0f172a]/30 hover:text-[#0f172a] dark:text-white/30 dark:hover:text-white/70 cursor-pointer">
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
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-[#F8FAFF] dark:bg-[#1c1c1e] border border-[#DBEAFE] dark:border-white/8 text-[#0f172a] dark:text-white/90 placeholder:text-[#0f172a]/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
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
  const { userNum, profileImg, token } = useAuthStore();
  const { show } = useSnackbar();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reconnectCountRef = useRef(0);

  const initSocket = useCallback(() => {
    const socket = io(NEST_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      reconnectCountRef.current = 0;
      socket.emit('joinRoom', {
        roomNum: room.roomNum,
        // 로그인 사용자 프로필 이미지 전달
        senderProfile: profileImg ?? null,
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setReconnecting(true);
    });

    socket.on('connect_error', () => {
      reconnectCountRef.current += 1;
      if (reconnectCountRef.current >= MAX_RECONNECT) {
        setReconnecting(false);
        show('서버 연결에 실패했습니다. 페이지를 새로고침해 주세요.', 'error');
      }
    });

    socket.on('messageHistory', (history: Message[]) => {
      setMessages(history);
      // 50개 미만이면 이전 메시지 없음
      setHasMore(history.length >= 50);
    });

    socket.on('newMessage', (msg: Message) => setMessages((prev) => [...prev, msg]));

    return socket;
  }, [room.roomNum, token, profileImg, show]);

  useEffect(() => {
    if (token) {
      void nestApi.post(`/chat/rooms/${room.roomNum}/join`).catch(() => {});
    }

    const socket = initSocket();

    return () => {
      socket.emit('leaveRoom', { roomNum: room.roomNum });
      socket.disconnect();
    };
  }, [room.roomNum, token, initSocket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 이전 메시지 더보기 — 첫 메시지 _id 기준 before 쿼리
  const loadMore = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0]._id;
      const res = await nestApi.get<Message[]>(`/chat/rooms/${room.roomNum}/messages?before=${oldest}`);
      if (res.data.length === 0) {
        setHasMore(false);
      } else {
        setMessages((prev) => [...res.data, ...prev]);
        setHasMore(res.data.length >= 50);
      }
    } catch {
      show('이전 메시지를 불러오지 못했습니다', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const sendMessage = () => {
    if (!token) {
      show('로그인 후 채팅에 참여할 수 있습니다', 'warning');
      return;
    }
    const trimmed = input.trim();
    if (!trimmed || !socketRef.current) return;

    // userNum·senderName은 서버가 JWT에서 직접 추출 — 클라이언트 위변조 방지
    socketRef.current.emit('sendMessage', {
      roomNum: room.roomNum,
      content: trimmed,
    });
    setInput('');
  };

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-[#2c2c2e] rounded-3xl border border-[#DBEAFE]/40 dark:border-white/8 shadow-sm overflow-hidden">

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#DBEAFE]/40 dark:border-white/8 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0f172a]/30 hover:text-[#0f172a] hover:bg-[#EFF6FF] dark:text-white/30 dark:hover:text-white/70 dark:hover:bg-white/8 transition-all flex-shrink-0 cursor-pointer"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#0f172a] dark:text-white/90 truncate">{room.roomName}</p>
          <p className="text-xs text-[#0f172a]/40 dark:text-white/30">{room.memberCount}명 참여 중</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium flex-shrink-0 ${
          connected
            ? 'text-emerald-500'
            : reconnecting
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-[#0f172a]/20 dark:text-white/20'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            connected
              ? 'bg-emerald-500'
              : reconnecting
              ? 'bg-amber-400 animate-pulse'
              : 'bg-[#0f172a]/20 dark:bg-white/20'
          }`} />
          {connected ? '연결됨' : reconnecting ? '재연결 중...' : '연결 끊김'}
        </span>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">

        {/* 이전 메시지 더보기 버튼 */}
        {hasMore && messages.length > 0 && (
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="self-center flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-[#2563EB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#2563EB]/10 hover:bg-[#DBEAFE] dark:hover:bg-[#2563EB]/20 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronUp size={12} />
            {loadingMore ? '불러오는 중...' : '이전 메시지 보기'}
          </button>
        )}

        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-[#0f172a]/20 dark:text-white/20 gap-2 py-16">
            <p className="text-sm">아직 대화가 없습니다</p>
            <p className="text-xs">첫 번째 메시지를 보내보세요</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.userNum === userNum;
          return (
            <div key={msg._id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* 상대방 아바타 */}
              {!isMine && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-[#DBEAFE] dark:bg-[#2563EB]/20 flex items-center justify-center self-end mb-4">
                  {msg.senderProfile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.senderProfile} alt={msg.senderName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA]">
                      {msg.senderName.charAt(0)}
                    </span>
                  )}
                </div>
              )}

              <div className={`flex flex-col gap-1 max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && (
                  <span className="text-xs text-[#0f172a]/40 dark:text-white/30 px-1">{msg.senderName}</span>
                )}
                <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                  isMine
                    ? 'bg-[#2563EB] text-white rounded-br-sm'
                    : 'bg-[#EFF6FF] dark:bg-white/8 text-[#0f172a] dark:text-white/80 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-[#0f172a]/25 dark:text-white/20 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="px-4 py-3 border-t border-[#DBEAFE]/40 dark:border-white/8 flex-shrink-0">
        {token ? (
          <div className="flex items-center gap-2 bg-[#F8FAFF] dark:bg-[#1c1c1e] rounded-2xl px-4 py-2.5 border border-[#DBEAFE] dark:border-white/8 focus-within:ring-2 focus-within:ring-[#2563EB]/20 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="메시지를 입력하세요..."
              maxLength={500}
              className="flex-1 bg-transparent text-sm text-[#0f172a] dark:text-white/90 placeholder:text-[#0f172a]/30 dark:placeholder:text-white/30 outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="w-7 h-7 rounded-xl bg-[#2563EB] flex items-center justify-center text-white disabled:opacity-30 hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:cursor-default flex-shrink-0"
            >
              <Send size={13} />
            </button>
          </div>
        ) : (
          <p className="text-xs text-center text-[#0f172a]/30 dark:text-white/30 py-1">
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
