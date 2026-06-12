'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, RotateCcw, History, Wand2 } from 'lucide-react';
import usePlanStore from '@/store/usePlanStore';
import { STYLE_CHIPS, nowHHMM, GenerateAction } from './types';
import { buildContextChips } from './utils/chips';
import { getCoachingForDate } from './utils/coaching';
import { useChatMessages } from './hooks/useChatMessages';
import { useCityKeywords } from './hooks/useCityKeywords';
import ThinkingBox from './ThinkingBox';
import AiBubble from './AiBubble';
import ActionCard from './ActionCard';

// 부모(데스크톱 LeftPanel AI 탭 / 모바일 하단 AI 탭)가 표시 영역을 결정 — 패널은 항상 열린 상태
interface Props {
  city: string;
}

// 스크롤이 바닥에서 이 거리(px) 안이면 '바닥에 붙어 있다'고 보고 자동 스크롤을 따라가게 한다
const NEAR_BOTTOM_PX = 80;

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
  // LLM이 day_cities 키를 날짜순으로 주지 않을 수 있어 — 키(YYYY-MM-DD) 기준 정렬해야 "N일차" 라벨이 실제 날짜 순서와 맞는다
  const cityEntries = Object.entries(generate.day_cities ?? {})
    .filter(([, c]) => c && c !== '_skip')
    .sort(([a], [b]) => a.localeCompare(b));
  // 특정 날짜만 다시 짜는 재생성 — 기존 장소를 비우고 채우므로 카드에 명시해 사용자가 인지하게 한다
  const regenDates = [...(generate.regenerate_dates ?? [])].sort((a, b) => a.localeCompare(b));
  const isRegen = regenDates.length > 0;
  return (
    <div className="w-full rounded-xl border border-[#DBEAFE] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-white/[0.03] p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Wand2 size={15} className="text-[#2563EB] dark:text-[#60A5FA]" />
        <span className="text-[13px] font-semibold text-[#0f172a] dark:text-white/90 tracking-tight">
          {isRegen ? '선택한 날짜 다시 짜기' : '전체 일정 자동생성'}
        </span>
      </div>
      {isRegen ? (
        <span className="text-[12px] text-[#0f172a]/65 dark:text-zinc-400">
          <span className="font-medium text-[#0f172a]/85 dark:text-zinc-200">{regenDates.length}개 날짜</span>의 기존 장소를 비우고 다시 짜드려요 — 공항·숙소는 그대로 둬요
        </span>
      ) : cityEntries.length > 0 ? (
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
          {isRegen ? '다시 짜기' : '생성'}
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

export default function AiChatPanel({ city }: Props) {
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const selectedDate = usePlanStore((s) => s.selectedDate);
  const aiBusy = usePlanStore((s) => s.aiBusy);
  // 이미 띄운 코칭 조합("date|kind")을 기억 — 같은 날 같은 지적을 반복하지 않는다
  const shownCoachingRef = useRef<Set<string>>(new Set());
  // 사용자가 위로 올려 읽는 중인지 — 바닥 근처일 때만 자동 스크롤로 따라간다 (스크롤 강탈 방지)
  const stickToBottomRef = useRef(true);

  const cityKeywords = useCityKeywords();
  const { messages, setMessages, loading, travelStyle, setTravelStyle, sendMessage, reset, cancel, runGenerate } = useChatMessages(city, cityKeywords);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    // 스트리밍 중엔 토큰마다 불려 smooth 애니메이션이 겹치므로 즉시 이동, 평상시엔 부드럽게
    bottomRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 마운트 시 일정 분석 1회 — 초기 메시지 1개이고 도시·날짜가 있을 때만 선제적 안내 삽입
  useEffect(() => {
    if (!city || messages.length > 1 || dayPlans.length === 0) return;

    const emptyDays = dayPlans.filter((dp) => dp.places.filter((p) => !p.slotType).length === 0);
    const lightDays = dayPlans.filter((dp) => {
      const n = dp.places.filter((p) => !p.slotType).length;
      return n > 0 && n < 3;
    });
    const totalDays = dayPlans.length;

    let hint = '';
    if (emptyDays.length === totalDays) {
      hint = `**${city}** ${totalDays}일 여행을 준비 중이시군요. 아직 일정이 비어 있는데, 어떤 스타일로 다니실 계획인가요?\n맛집 탐방, 관광지 위주, 쇼핑 중심 등 알려주시면 그에 맞춰 추천해 드리겠습니다.`;
    } else if (emptyDays.length > 0) {
      const labels = emptyDays.map((dp) => `**Day ${dayPlans.indexOf(dp) + 1}**`).join(', ');
      hint = `일정을 살펴보니 ${labels}이 아직 비어 있어요.\n해당 날짜에 어울리는 장소를 추천해 드릴까요?`;
    } else if (lightDays.length > 0) {
      const idx = dayPlans.indexOf(lightDays[0]) + 1;
      hint = `**Day ${idx}** 일정에 여유가 있어요. 근처 맛집이나 카페를 넣어드릴까요?`;
    }

    if (hint) {
      setMessages((prev) => [...prev, { role: 'ai', text: hint, timestamp: nowHHMM() }]);
    }
    // 마운트 시점 값으로 1회만 판단 — deps를 채우면 메시지·일정 변경마다 재실행돼 안내가 중복 삽입된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 능동적 코칭 — 사용자가 일정을 직접 바꾸면 현재 날짜를 휴리스틱으로 점검해 먼저 제안한다.
  // 보수적 가드: city 있음 + 응답·AI작업 중 아님 + 처리 대기 중인 action 카드 없음.
  // 같은 날 같은 종류는 shownCoachingRef로 한 번만 — 과하면 짜증나므로 반복 억제
  useEffect(() => {
    if (!city || loading || aiBusy) return;
    if (!selectedDate || selectedDate === 'all') return;
    // 마지막 AI 메시지가 처리 대기 중인 카드(추가·생성 제안)를 들고 있으면 침묵 — 흐름 방해 방지
    const last = messages[messages.length - 1];
    if (last?.role === 'ai' && last.action) return;

    const suggestion = getCoachingForDate(dayPlans, selectedDate);
    if (!suggestion) return;
    const key = `${suggestion.date}|${suggestion.kind}`;
    if (shownCoachingRef.current.has(key)) return;
    shownCoachingRef.current.add(key);

    setMessages((prev) => [
      ...prev,
      { role: 'ai', text: suggestion.message, followUps: [suggestion.followUp], timestamp: nowHHMM() },
    ]);
  }, [dayPlans, selectedDate, city, loading, aiBusy, messages, setMessages]);

  // 내가 보낸 메시지는 위를 읽고 있었어도 따라간다 — 답변을 보려는 의도가 명확하므로
  function handleSend() { stickToBottomRef.current = true; void sendMessage(input); setInput(''); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      stickToBottomRef.current = true;
      void sendMessage(input);
      setInput('');
    }
  }

  function handleQuickReply(text: string) { stickToBottomRef.current = true; void sendMessage(text); }

  function handleReset() {
    reset();
    setHistoryCollapsed(false);
    // 대화를 비우면 코칭 이력도 초기화 — 새 대화에서 다시 지적받을 수 있게
    shownCoachingRef.current.clear();
  }

  const contextChips = buildContextChips(dayPlans, city);
  const showQuickReplies = messages.length === 1 && city && !loading;
  const showStyleOnboarding = messages.length === 1 && city && !travelStyle && dayPlans.length === 0;

  return (
    <div className="relative flex flex-col w-full h-full bg-white dark:bg-[#1c1c1e]">
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
        </div>
      </div>

      {/* 메시지 목록 */}
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
        }}
        className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-h-0 bg-white dark:bg-[#1c1c1e]"
      >
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
                  // whitespace-pre-wrap — Shift+Enter로 넣은 줄바꿈(\n)을 그대로 렌더 (기본은 HTML이 무시)
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#2563EB] dark:bg-[#3B82F6] text-white text-[14px] leading-[1.55] tracking-tight whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                ) : msg.isError ? (
                  <div className="w-full px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/40 text-red-700 dark:text-red-300 text-[13px] leading-[1.6] whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                ) : msg.text ? (
                  <div className="w-full">
                    <AiBubble text={msg.text} />
                    {msg.isPending && msg.progress && msg.progress.total > 0 && (
                      // 자동생성 진행 막대 — 채울 날짜 수 기준 비율
                      <div className="pt-2 pl-0.5 pr-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-[#2563EB] dark:text-[#60A5FA] font-semibold tabular-nums">
                            {msg.progress.current}/{msg.progress.total}일
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-white/30 tabular-nums">
                            {Math.round((msg.progress.current / msg.progress.total) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#EFF6FF] dark:bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#2563EB] dark:bg-[#3B82F6] transition-[width] duration-300 ease-out"
                            style={{ width: `${(msg.progress.current / msg.progress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
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
                        { role: 'ai', text: `**${chip.label}** 스타일이라면 취향에 맞는 곳을 잘 안내해 드릴 수 있어요.\n여행 날짜를 먼저 설정해 주시면 그 스타일에 맞는 코스를 바로 구성해 드리겠습니다.` },
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
  );
}
