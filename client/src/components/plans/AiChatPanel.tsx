'use client';
import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, MessageCircle } from 'lucide-react';
import { aiApi } from '@/config/api.config';
import usePlanStore from '@/store/usePlanStore';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface Props {
  city: string;
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

  // 메시지 추가 시 스크롤 하단 유지
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 패널 열릴 때 입력창 포커스
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

      const res = await aiApi.post<{ reply: string }>('/api/chat', {
        message: text,
        city,
        day_plans: dayPlansPayload,
      });
      setMessages((prev) => [...prev, { role: 'ai', text: res.data.reply }]);
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
        <div className="absolute bottom-20 right-4 z-30 w-80 max-h-[480px] flex flex-col rounded-2xl shadow-2xl bg-white dark:bg-[#2c2c2e] border border-[#DBEAFE]/40 dark:border-white/8 overflow-hidden">
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
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
              <Send size={13} className="text-white disabled:text-gray-400" />
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
