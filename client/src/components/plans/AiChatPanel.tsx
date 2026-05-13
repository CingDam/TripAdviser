'use client';
import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, MapPin, Plus, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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

// 타이핑 점 애니메이션
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#2563EB]/40 dark:bg-[#60A5FA]/40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

// 장소 추가 액션 카드
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
    <div className="mt-2 rounded-2xl rounded-tl-sm overflow-hidden border border-[#DBEAFE] dark:border-[#2563EB]/20 bg-white dark:bg-[#1e2a3a]">
      {/* 장소 목록 */}
      <div className="px-3 pt-3 pb-2 space-y-1.5">
        {action.places.map((name, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs text-[#0f172a] dark:text-white/80 bg-[#EFF6FF] dark:bg-[#2563EB]/10 px-2.5 py-1.5 rounded-lg"
          >
            <MapPin size={10} className="text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0" />
            <span className="font-medium">{name}</span>
          </div>
        ))}
      </div>

      {/* 날짜 선택 + 추가 버튼 */}
      <div className="px-3 pb-3 space-y-2">
        {availableDates.length > 0 ? (
          <>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`w-full text-xs px-2.5 py-2 rounded-xl border outline-none bg-white dark:bg-[#252527] text-[#0f172a] dark:text-white/80 cursor-pointer transition-all ${
                !selectedDate
                  ? 'border-[#DBEAFE] dark:border-white/10 text-gray-400 dark:text-white/30'
                  : 'border-[#2563EB] dark:border-[#3B82F6] ring-1 ring-[#2563EB]/20'
              }`}
            >
              <option value="">날짜를 선택해주세요</option>
              {availableDates.map((date, i) => (
                <option key={date} value={date}>Day {i + 1} · {date}</option>
              ))}
            </select>
            <button
              onClick={() => void handleAdd()}
              disabled={adding}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {adding ? '추가 중...' : '일정에 추가하기'}
            </button>
          </>
        ) : (
          <p className="text-xs text-center text-gray-400 dark:text-white/30 py-1">
            먼저 여행 날짜를 설정해주세요.
          </p>
        )}
      </div>
    </div>
  );
}

// AI 답변 말풍선 — 마크다운 렌더링
function AiBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[88%] px-3 py-2.5 rounded-2xl rounded-tl-sm bg-[#F0F4FF] dark:bg-[#252527] text-[#0f172a] dark:text-white/85 text-sm leading-relaxed">
      <ReactMarkdown
        components={{
          // 볼드 — 강조 색상
          strong: ({ children }) => (
            <strong className="font-bold text-[#2563EB] dark:text-[#60A5FA]">{children}</strong>
          ),
          // 리스트 — 깔끔한 간격
          ul: ({ children }) => <ul className="mt-1.5 space-y-1 pl-1">{children}</ul>,
          li: ({ children }) => (
            <li className="flex items-start gap-1.5 text-xs">
              <span className="mt-1 w-1 h-1 rounded-full bg-[#2563EB]/50 dark:bg-[#60A5FA]/50 flex-shrink-0" />
              <span>{children}</span>
            </li>
          ),
          // 단락 — 기본 여백
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function AiChatPanel({ city }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: `**${city}** 여행 도우미예요.\n일정 추천이나 여행 팁을 물어보세요!` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dayPlans = usePlanStore((s) => s.dayPlans);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
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
        <div className="absolute bottom-20 right-4 z-30 w-[320px] max-h-[540px] flex flex-col rounded-3xl shadow-2xl bg-white dark:bg-[#1c1c1e] border border-[#DBEAFE]/60 dark:border-white/8 overflow-hidden"
          style={{ boxShadow: '0 8px 40px rgba(37,99,235,0.15), 0 2px 8px rgba(0,0,0,0.08)' }}
        >
          {/* 헤더 — 그라디언트 */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-none">AI 여행 도우미</p>
                <p className="text-[10px] text-white/60 mt-0.5">{city}</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="채팅 닫기"
            >
              <X size={14} className="text-white" />
            </button>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 min-h-0 bg-[#F8FAFF] dark:bg-[#1c1c1e]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start items-end'}`}
              >
                {/* AI 아바타 */}
                {msg.role === 'ai' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center flex-shrink-0 mb-0.5 shadow-sm">
                    <Bot size={12} className="text-white" />
                  </div>
                )}

                <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[82%]`}>
                  {msg.role === 'user' ? (
                    <div className="px-3 py-2.5 rounded-2xl rounded-br-sm bg-[#2563EB] text-white text-sm leading-relaxed">
                      {msg.text}
                    </div>
                  ) : (
                    <AiBubble text={msg.text} />
                  )}

                  {/* 액션 카드 */}
                  {msg.role === 'ai' && msg.action && (
                    <div className="w-full">
                      <ActionCard
                        action={msg.action}
                        city={city}
                        onDone={() =>
                          setMessages((prev) =>
                            prev.map((m, idx) => idx === i ? { ...m, action: undefined } : m)
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* 타이핑 애니메이션 */}
            {loading && (
              <div className="flex gap-2 items-end justify-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot size={12} className="text-white" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-[#F0F4FF] dark:bg-[#252527]">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="px-3 py-3 bg-white dark:bg-[#2c2c2e] border-t border-[#DBEAFE]/40 dark:border-white/8">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#F0F4FF] dark:bg-[#252527] border border-[#DBEAFE]/60 dark:border-white/8 transition-all focus-within:border-[#2563EB]/40 dark:focus-within:border-[#3B82F6]/40 focus-within:ring-2 focus-within:ring-[#2563EB]/10">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                maxLength={500}
                className="flex-1 text-sm bg-transparent outline-none text-[#0f172a] dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-xl bg-[#2563EB] disabled:bg-gray-200 dark:disabled:bg-white/10 flex items-center justify-center transition-all active:scale-90 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                aria-label="메시지 전송"
              >
                <Send size={12} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="AI 여행 도우미"
        className="absolute bottom-4 right-4 z-30 w-13 h-13 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] active:scale-95 text-white shadow-xl flex items-center justify-center transition-all cursor-pointer"
        style={{ width: 52, height: 52, boxShadow: '0 4px 20px rgba(37,99,235,0.45)' }}
        aria-label="AI 여행 도우미 열기"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>
    </>
  );
}
