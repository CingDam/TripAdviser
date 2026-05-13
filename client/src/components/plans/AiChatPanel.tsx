'use client';
import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, MessageCircle, MapPin, Plus } from 'lucide-react';
import { aiApi, nestApi } from '@/config/api.config';
import usePlanStore, { GooglePlace } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';

interface ChatAction {
  places: string[];
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  action?: ChatAction;
}

interface Props {
  city: string;
}

// action 말풍선 — 날짜 드롭다운 + 추가 버튼
function ActionCard({ action, city, onDone }: { action: ChatAction; city: string; onDone: () => void }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const addPlaceToDayPlan = usePlanStore((s) => s.addPlaceToDayPlan);
  const { show } = useSnackbar();

  const availableDates = dayPlans.map((d) => d.date);

  async function handleAdd() {
    if (!selectedDate) {
      show('날짜를 선택해주세요.', 'warning');
      return;
    }
    setAdding(true);
    let added = 0;
    for (const name of action.places) {
      try {
        const res = await nestApi.post<GooglePlace | null>('/place-search/resolve', { name, city });
        if (res.data) {
          addPlaceToDayPlan(selectedDate, { ...res.data, rating: null });
          added++;
        }
      } catch {
        // 개별 실패 무시
      }
    }
    setAdding(false);
    setDone(true);
    show(`${added}개 장소를 일정에 추가했어요.`, 'success');
    onDone();
  }

  if (done) return null;

  return (
    <div className="mt-2 p-3 rounded-xl bg-white dark:bg-[#2c2c2e] border border-[#DBEAFE] dark:border-white/10 space-y-2">
      {/* 장소 목록 */}
      <ul className="space-y-1">
        {action.places.map((name, i) => (
          <li key={i} className="flex items-center gap-1.5 text-xs text-[#0f172a] dark:text-white/80">
            <MapPin size={11} className="text-[#2563EB] flex-shrink-0" />
            {name}
          </li>
        ))}
      </ul>

      {/* 날짜 선택 */}
      {availableDates.length > 0 ? (
        <select
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className={`w-full text-xs px-2 py-1.5 rounded-lg border outline-none bg-white dark:bg-[#252527] text-[#0f172a] dark:text-white/80 cursor-pointer transition-colors ${
            !selectedDate
              ? 'border-[#DBEAFE] dark:border-white/10'
              : 'border-[#2563EB] dark:border-[#3B82F6]'
          }`}
        >
          <option value="">날짜를 선택해주세요</option>
          {availableDates.map((date, i) => (
            <option key={date} value={date}>Day {i + 1} · {date}</option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-gray-400 dark:text-white/30">먼저 여행 날짜를 설정해주세요.</p>
      )}

      {/* 추가 버튼 */}
      {availableDates.length > 0 && (
        <button
          onClick={() => void handleAdd()}
          disabled={adding}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-200 dark:disabled:bg-white/10 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {adding
            ? <Loader2 size={12} className="animate-spin" />
            : <Plus size={12} />
          }
          {adding ? '추가 중...' : '일정에 추가'}
        </button>
      )}
    </div>
  );
}

export default function AiChatPanel({ city }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: `${city} 여행 도우미예요. 일정 추천이나 여행 팁을 물어보세요!` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dayPlans = usePlanStore((s) => s.dayPlans);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const dayPlansPayload = dayPlans.map((dp) => ({
        date: dp.date,
        // 슬롯(호텔·공항)은 AI 컨텍스트에서 제외 — 일반 관광 일정만 전달
        places: dp.places.filter((p) => !p.slotType).map((p) => p.name),
      }));

      const res = await aiApi.post<{ reply: string; action?: ChatAction }>('/api/chat', {
        message: text,
        city,
        day_plans: dayPlansPayload,
      });

      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: res.data.reply, action: res.data.action },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: '일시적으로 응답하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <>
      {/* 채팅 패널 */}
      {open && (
        <div className="absolute bottom-20 right-4 z-30 w-80 max-h-[520px] flex flex-col rounded-2xl shadow-2xl bg-white dark:bg-[#2c2c2e] border border-[#DBEAFE]/40 dark:border-white/8 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#2563EB] dark:bg-[#1D4ED8]">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-white" />
              <span className="text-sm font-bold text-white">AI 여행 도우미</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors cursor-pointer"
              aria-label="채팅 닫기"
            >
              <X size={16} />
            </button>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#2563EB] text-white rounded-br-sm'
                      : 'bg-[#EFF6FF] dark:bg-[#252527] text-[#0f172a] dark:text-white/80 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                {/* action 카드 — AI 메시지에만 표시 */}
                {msg.role === 'ai' && msg.action && (
                  <div className="w-[85%]">
                    <ActionCard
                      action={msg.action}
                      city={city}
                      onDone={() => {
                        // 추가 완료 후 action 제거 — 중복 추가 방지
                        setMessages((prev) =>
                          prev.map((m, idx) => idx === i ? { ...m, action: undefined } : m)
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#EFF6FF] dark:bg-[#252527] px-3 py-2 rounded-2xl rounded-bl-sm">
                  <Loader2 size={14} className="animate-spin text-[#2563EB]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-[#DBEAFE]/30 dark:border-white/8">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="질문을 입력하세요"
              maxLength={500}
              className="flex-1 text-sm bg-transparent outline-none text-[#0f172a] dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/30"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-full bg-[#2563EB] disabled:bg-gray-200 dark:disabled:bg-white/10 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
              aria-label="메시지 전송"
            >
              <Send size={13} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* FAB 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="AI 여행 도우미"
        className="absolute bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] active:scale-95 text-white shadow-xl flex items-center justify-center transition-all cursor-pointer"
        style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.4)' }}
        aria-label="AI 여행 도우미 열기"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  );
}
