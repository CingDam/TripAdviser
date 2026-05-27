'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, RotateCcw, History, Wand2 } from 'lucide-react';
import usePlanStore from '@/store/usePlanStore';
import { STYLE_CHIPS, nowHHMM, GenerateAction } from './types';
import { buildContextChips } from './utils/chips';
import { useChatMessages } from './hooks/useChatMessages';
import { useCityKeywords } from './hooks/useCityKeywords';
import ThinkingBox from './ThinkingBox';
import AiBubble from './AiBubble';
import ActionCard from './ActionCard';

interface Props {
  city: string;
  // fullpage: 탭 전체 차지 (FAB·X버튼 없음, 항상 열린 상태) — 모바일 AI 탭 전용
  mode?: 'sidebar' | 'fullpage';
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-3">
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

// 전체 일정 자동생성 확인 카드 — [생성] 클릭 시 runGenerate 실행
function GenerateCard({ generate, disabled, onConfirm, onCancel }: {
  generate: GenerateAction;
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cityEntries = Object.entries(generate.day_cities ?? {}).filter(([, c]) => c && c !== '_skip');
  return (
    <div className="w-full rounded-xl border border-[#DBEAFE] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-white/[0.03] p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Wand2 size={15} className="text-[#2563EB] dark:text-[#60A5FA]" />
        <span className="text-[13px] font-semibold text-[#0f172a] dark:text-white/90 tracking-tight">전체 일정 자동생성</span>
      </div>
      {cityEntries.length > 0 ? (
        <div className="flex flex-col gap-1">
          {cityEntries.map(([date, c], idx) => (
            <span key={date} className="text-[12px] text-[#0f172a]/65 dark:text-zinc-400">
              {idx + 1}일차 · <span className="font-medium text-[#0f172a]/85 dark:text-zinc-200">{c}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[12px] text-[#0f172a]/65 dark:text-zinc-400">
          <span className="font-medium text-[#0f172a]/85 dark:text-zinc-200">{generate.city}</span> 기준으로 전체 일정을 채워드려요
        </span>
      )}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={disabled}
          className="flex-1 py-2 rounded-lg bg-[#2563EB] dark:bg-[#3B82F6] text-white text-[13px] font-semibold hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          생성
        </button>
        <button
          onClick={onCancel}
          disabled={disabled}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#0f172a]/45 dark:text-zinc-400 hover:text-[#0f172a]/70 dark:hover:text-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
        >
          취소
        </button>
      </div>
    </div>
  );
}

export default function AiChatPanel({ city, mode = 'sidebar' }: Props) {
  const isFullpage = mode === 'fullpage';
  const [open, setOpen] = useState(isFullpage);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const dayPlans = usePlanStore((s) => s.dayPlans);

  const cityKeywords = useCityKeywords();
  const { messages, setMessages, loading, travelStyle, setTravelStyle, sendMessage, reset, cancel, runGenerate } = useChatMessages(city, cityKeywords);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // 패널 열릴 때 일정 분석 — 초기 메시지 1개이고 도시·날짜가 있을 때만 선제적 안내 삽입
  const prevOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened || !city || messages.length > 1 || dayPlans.length === 0) return;

    const emptyDays = dayPlans.filter((dp) => dp.places.filter((p) => !p.slotType).length === 0);
    const lightDays = dayPlans.filter((dp) => {
      const n = dp.places.filter((p) => !p.slotType).length;
      return n > 0 && n < 3;
    });
    const totalDays = dayPlans.length;

    let hint = '';
    if (emptyDays.length === totalDays) {
      hint = `오~ **${city}** ${totalDays}일 여행이네요! 아직 일정이 비어있는데, 어떤 스타일로 다니실 거예요?\n맛집 탐방? 관광지 위주? 아니면 쇼핑도 좀 하실 건가요? 😊`;
    } else if (emptyDays.length > 0) {
      const labels = emptyDays.map((dp) => `**Day ${dayPlans.indexOf(dp) + 1}**`).join(', ');
      hint = `일정 살펴봤는데, ${labels}이 아직 비어있어요!\n해당 날에 어울리는 장소 추천해드릴까요? ✨`;
    } else if (lightDays.length > 0) {
      const idx = dayPlans.indexOf(lightDays[0]) + 1;
      hint = `**Day ${idx}** 일정이 조금 여유롭네요. 근처 맛집이나 카페 넣어드릴까요? ☕`;
    }

    if (hint) {
      setMessages((prev) => [...prev, { role: 'ai', text: hint, timestamp: nowHHMM() }]);
    }
  }, [open, city, dayPlans, messages.length, setMessages]);

  function handleSend() { void sendMessage(input); setInput(''); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage(input);
      setInput('');
    }
  }

  function handleQuickReply(text: string) { void sendMessage(text); }

  function handleReset() {
    reset();
    setHistoryCollapsed(false);
  }

  const contextChips = buildContextChips(dayPlans, city);
  const showQuickReplies = messages.length === 1 && city && !loading;
  const showStyleOnboarding = messages.length === 1 && city && !travelStyle && dayPlans.length === 0;
  const panelVisible = isFullpage || open;

  return (
    <>
      {panelVisible && (
        <div
          className={
            isFullpage
              ? 'relative flex flex-col w-full h-full bg-white dark:bg-[#1c1c1e]'
              : 'absolute top-0 right-0 z-30 flex flex-col bg-white dark:bg-[#1c1c1e] border-l border-[#DBEAFE] dark:border-white/[0.08] animate-[slideInRight_0.22s_cubic-bezier(0.25,0.46,0.45,0.94)]'
          }
          style={isFullpage ? undefined : {
            width: 'min(420px, 92vw)',
            height: '100%',
            boxShadow: '-8px 0 32px rgba(15,23,42,0.06)',
          }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#DBEAFE] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <Sparkles size={14} className="text-[#2563EB] dark:text-[#60A5FA]" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold tracking-tight text-[#0f172a] dark:text-zinc-100 leading-none">AI 여행 도우미</p>
                  {travelStyle && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-white/[0.06] text-[#2563EB] dark:text-[#60A5FA] leading-none truncate max-w-[90px]">
                      {travelStyle.replace(' 위주', '')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#0f172a]/40 dark:text-zinc-500 mt-1 leading-none">{city || '여행지 미설정'}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {messages.length >= 3 && (
                <button
                  onClick={() => setHistoryCollapsed((v) => !v)}
                  className="w-8 h-8 rounded-lg hover:bg-[#EFF6FF] dark:hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer text-[#0f172a]/40 hover:text-[#2563EB] dark:text-zinc-400 dark:hover:text-zinc-100"
                  aria-label={historyCollapsed ? '이전 대화 보기' : '이전 대화 접기'}
                  title={historyCollapsed ? '이전 대화 보기' : '이전 대화 접기'}
                >
                  <History size={15} strokeWidth={2} />
                </button>
              )}
              <button
                onClick={handleReset}
                className="w-8 h-8 rounded-lg hover:bg-[#EFF6FF] dark:hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer text-[#0f172a]/40 hover:text-[#2563EB] dark:text-zinc-400 dark:hover:text-zinc-100"
                aria-label="대화 초기화"
                title="대화 초기화"
              >
                <RotateCcw size={15} strokeWidth={2} />
              </button>
              {!isFullpage && (
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-[#EFF6FF] dark:hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer text-[#0f172a]/40 hover:text-[#2563EB] dark:text-zinc-400 dark:hover:text-zinc-100"
                  aria-label="채팅 닫기"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-h-0 bg-white dark:bg-[#1c1c1e]">
            {historyCollapsed && messages.length >= 3 && (
              <button
                onClick={() => setHistoryCollapsed(false)}
                className="w-full text-center text-xs text-[#0f172a]/40 hover:text-[#2563EB] dark:text-zinc-400 dark:hover:text-zinc-100 py-2 rounded-lg hover:bg-[#EFF6FF] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                이전 대화 {messages.length - 2}개 더 보기
              </button>
            )}

            {messages.map((msg, i) => {
              if (historyCollapsed && messages.length >= 3 && i > 0 && i < messages.length - 2) return null;
              return (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end max-w-[85%]' : 'items-start w-full'}`}>
                    {msg.role === 'ai' && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                      <ThinkingBox
                        steps={msg.thinkingSteps}
                        ms={msg.thinkingMs}
                        loading={loading && i === messages.length - 1 && !msg.text}
                      />
                    )}

                    {msg.role === 'user' ? (
                      <div className="px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#2563EB] dark:bg-[#3B82F6] text-white text-[14px] leading-[1.55] tracking-tight">
                        {msg.text}
                      </div>
                    ) : msg.isError ? (
                      <div className="w-full px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/40 text-red-700 dark:text-red-300 text-[13px] leading-[1.6]">
                        {msg.text}
                      </div>
                    ) : msg.text ? (
                      <div className="w-full">
                        <AiBubble text={msg.text} />
                        {msg.isPending && (
                          <div className="flex items-center gap-1.5 pt-1.5 pl-0.5">
                            <TypingDots />
                          </div>
                        )}
                      </div>
                    ) : null}

                    {msg.timestamp && (
                      <span className="text-[10px] text-[#0f172a]/30 dark:text-zinc-600 px-0.5 leading-none">
                        {msg.timestamp}
                      </span>
                    )}

                    {msg.role === 'ai' && msg.action?.generate && (
                      <div className="w-full">
                        <GenerateCard
                          generate={msg.action.generate}
                          disabled={loading}
                          onConfirm={() => {
                            const g = msg.action!.generate!;
                            setMessages((prev) => prev.map((m, idx) => idx === i ? { ...m, action: undefined } : m));
                            void runGenerate(g);
                          }}
                          onCancel={() =>
                            setMessages((prev) => prev.map((m, idx) => idx === i ? { ...m, action: undefined } : m))
                          }
                        />
                      </div>
                    )}

                    {msg.role === 'ai' && msg.action && !msg.action.generate && (
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

                    {msg.role === 'ai' && msg.followUps && msg.followUps.length > 0 && i === messages.length - 1 && !loading && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.followUps.map((text) => (
                          <button
                            key={text}
                            onClick={() => handleQuickReply(text)}
                            className="text-[12px] px-2.5 py-1.5 rounded-lg border border-[#DBEAFE] dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-[#2563EB] dark:text-zinc-300 hover:bg-[#EFF6FF] hover:border-[#2563EB]/30 dark:hover:bg-white/[0.04] dark:hover:border-white/[0.14] transition-colors cursor-pointer font-medium tracking-tight"
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {showStyleOnboarding && (
              <div className="pt-1 space-y-2">
                <p className="text-xs text-[#0f172a]/50 dark:text-zinc-500 font-medium">어떤 여행 스타일인가요?</p>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      onClick={() => {
                        setTravelStyle(chip.value);
                        if (dayPlans.length === 0) {
                          setMessages((prev) => [
                            ...prev,
                            { role: 'user', text: `${chip.emoji} ${chip.label} 스타일로 여행할 거야. 추천해줘!` },
                            { role: 'ai', text: `좋아요! **${chip.label}** 스타일이면 취향 맞는 곳 잘 알아요 😊\n여행 날짜를 먼저 설정해주시면 그 스타일에 맞는 코스 바로 짜드릴게요!` },
                          ]);
                        } else {
                          void sendMessage(`${chip.emoji} ${chip.label} 스타일로 여행할 거야. 추천해줘!`);
                        }
                      }}
                      className="text-[12px] px-3 py-1.5 rounded-lg border border-[#DBEAFE] dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-[#2563EB] dark:text-zinc-300 hover:bg-[#EFF6FF] hover:border-[#2563EB]/30 dark:hover:bg-white/[0.04] dark:hover:border-white/[0.14] transition-colors cursor-pointer font-medium tracking-tight"
                    >
                      <span className="mr-1">{chip.emoji}</span>{chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showQuickReplies && !showStyleOnboarding && contextChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {contextChips.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleQuickReply(chip.text)}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-[#DBEAFE] dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-[#2563EB] dark:text-zinc-300 hover:bg-[#EFF6FF] hover:border-[#2563EB]/30 dark:hover:bg-white/[0.04] dark:hover:border-white/[0.14] transition-colors cursor-pointer font-medium tracking-tight"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {loading && !messages[messages.length - 1]?.isPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-[#EFF6FF] dark:bg-white/[0.04]">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="px-4 py-3 bg-white dark:bg-[#1c1c1e] border-t border-[#DBEAFE] dark:border-white/[0.08] flex-shrink-0">
            <div className="flex items-end gap-2 px-3 py-2 rounded-xl bg-[#F8FAFF] dark:bg-white/[0.04] border border-[#DBEAFE] dark:border-white/[0.08] transition-all focus-within:border-[#2563EB]/40 dark:focus-within:border-white/[0.20] focus-within:bg-white dark:focus-within:bg-white/[0.06]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={loading ? '응답 기다리는 중...' : '무엇이든 물어보세요'}
                maxLength={500}
                disabled={loading}
                rows={1}
                className="flex-1 text-[14px] bg-transparent outline-none text-[#0f172a] dark:text-zinc-100 placeholder:text-[#0f172a]/30 dark:placeholder:text-zinc-600 disabled:cursor-not-allowed resize-none leading-[1.5] overflow-hidden tracking-tight"
                style={{ minHeight: '22px', maxHeight: '120px' }}
              />
              <button
                onClick={loading ? cancel : handleSend}
                disabled={!loading && !input.trim()}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer flex-shrink-0 mb-0.5 ${
                  loading
                    ? 'bg-[#2563EB] dark:bg-[#3B82F6] text-white hover:bg-[#1D4ED8] dark:hover:bg-[#60A5FA]'
                    : 'bg-[#2563EB] dark:bg-[#3B82F6] text-white hover:bg-[#1D4ED8] dark:hover:bg-[#60A5FA] disabled:bg-[#DBEAFE] disabled:text-[#2563EB]/40 dark:disabled:bg-white/[0.06] dark:disabled:text-zinc-600 disabled:cursor-not-allowed'
                }`}
                aria-label={loading ? '응답 취소' : '메시지 전송'}
              >
                {loading ? <X size={13} strokeWidth={2.5} /> : <Send size={13} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB — sidebar 모드에서만 표시 */}
      {!isFullpage && !open && (
        <button
          onClick={() => setOpen(true)}
          title="AI 여행 도우미"
          className="absolute right-4 z-30 w-12 h-12 rounded-full bg-[#2563EB] dark:bg-[#3B82F6] text-white hover:bg-[#1D4ED8] dark:hover:bg-[#60A5FA] active:scale-95 flex items-center justify-center transition-all cursor-pointer"
          style={{
            bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 4px 16px rgba(37,99,235,0.3), 0 2px 4px rgba(37,99,235,0.15)',
          }}
          aria-label="AI 여행 도우미 열기"
        >
          <Sparkles size={18} strokeWidth={2.2} />
        </button>
      )}
    </>
  );
}
