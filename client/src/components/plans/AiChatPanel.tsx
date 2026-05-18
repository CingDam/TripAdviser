'use client';
import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, MapPin, Plus, Sparkles, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { nestApi } from '@/config/api.config';
import usePlanStore, { GooglePlace } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';

type ChatActionPlace = { name: string; category?: string | null };

interface ChatAction {
  places: (ChatActionPlace | string)[];
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  action?: ChatAction;
  isError?: boolean;
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

function getActionPlaceName(place: ChatActionPlace | string): string {
  return typeof place === 'string' ? place : place.name;
}

function getActionPlaceCategory(place: ChatActionPlace | string): string | null {
  return typeof place === 'string' ? null : place.category ?? null;
}

// 장소 추가 액션 카드
function ActionCard({ action, city, onDone }: { action: ChatAction; city: string; onDone: () => void }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [sortFailed, setSortFailed] = useState(false);
  const [lastAddedPlaces, setLastAddedPlaces] = useState<{ places: GooglePlace[]; date: string } | null>(null);
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const addPlaceToDayPlan = usePlanStore((s) => s.addPlaceToDayPlan);
  const reorderDayPlan = usePlanStore((s) => s.reorderDayPlan);
  const { show } = useSnackbar();

  const availableDates = dayPlans.map((d) => d.date);

  async function handleAdd() {
    if (!selectedDate) return;
    setAdding(true);
    let added = 0;
    let failed = 0;
    const selectedDay = dayPlans.find((d) => d.date === selectedDate);
    const currentPlaces = selectedDay?.places ?? [];
    const existingIds = new Set(currentPlaces.map((p) => p.place_id));
    const addedPlaces: GooglePlace[] = [];

    for (const place of action.places) {
      const name = getActionPlaceName(place);
      const category = getActionPlaceCategory(place);
      try {
        const res = await nestApi.post<GooglePlace | null>('/place-search/resolve', { name, city, category });
        if (res.data && !existingIds.has(res.data.place_id)) {
          const resolved = { ...res.data, rating: null, category: category ?? undefined };
          addPlaceToDayPlan(selectedDate, resolved);
          addedPlaces.push(resolved);
          existingIds.add(res.data.place_id);
          added++;
        }
      } catch {
        failed++;
      }
    }
    // sortFailed state는 비동기이므로 로컬 변수로 추적 — setState 후 즉시 참조하면 이전 값을 봄
    let sortFailedLocal = false;
    if (addedPlaces.length > 0) {
      const normalPlaces = [...currentPlaces.filter((p) => !p.slotType), ...addedPlaces];
      if (normalPlaces.length >= 2) {
        try {
          const response = await nestApi.post<{ places: { place: GooglePlace; time_slot: string }[] }>(
            '/ai/sort',
            { places: normalPlaces, date: selectedDate },
          );
          const sortedNormal = response.data.places.map((item) => ({ ...item.place, timeSlot: item.time_slot }));
          const firstNormalIdx = currentPlaces.findIndex((p) => !p.slotType);
          const lastNormalIdx = currentPlaces.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
          const beforeSlots = firstNormalIdx === -1 ? currentPlaces.filter((p) => p.slotType).slice(0, Math.ceil(currentPlaces.filter((p) => p.slotType).length / 2)) : currentPlaces.slice(0, firstNormalIdx);
          const afterSlots = lastNormalIdx === -1 ? currentPlaces.filter((p) => p.slotType).slice(Math.ceil(currentPlaces.filter((p) => p.slotType).length / 2)) : currentPlaces.slice(lastNormalIdx + 1);
          reorderDayPlan(selectedDate, [...beforeSlots, ...sortedNormal, ...afterSlots]);
        } catch {
          // 정렬 실패 시 추가된 장소는 유지하고 재정렬 버튼 노출
          sortFailedLocal = true;
          setSortFailed(true);
          setLastAddedPlaces({ places: normalPlaces, date: selectedDate });
        }
      }
    }
    setAdding(false);
    if (added > 0) {
      if (!sortFailedLocal) {
        show(`${added}개 장소를 일정에 추가하고 정렬했어요.`, 'success');
        setDone(true);
        onDone();
      }
      // sortFailed=true면 카드가 재정렬 UI로 전환되므로 onDone 호출 안 함
    } else {
      show('장소 정보를 가져오지 못했어요. 다시 시도해 주세요.', 'error');
    }
    if (failed > 0 && added > 0) {
      show(`${failed}개 장소는 찾을 수 없어 건너뛰었어요.`, 'warning');
    }
  }

  async function handleRetrySort() {
    if (!lastAddedPlaces) return;
    try {
      const response = await nestApi.post<{ places: { place: GooglePlace; time_slot: string }[] }>(
        '/ai/sort',
        { places: lastAddedPlaces.places, date: lastAddedPlaces.date },
      );
      const sorted = response.data.places.map((item) => ({ ...item.place, timeSlot: item.time_slot }));
      reorderDayPlan(lastAddedPlaces.date, sorted);
      setSortFailed(false);
      setLastAddedPlaces(null);
      show('정렬 완료!', 'success');
    } catch {
      show('정렬에 다시 실패했어요. 잠시 후 시도해 주세요.', 'error');
    }
  }

  if (done && !sortFailed) return null;

  // 정렬 실패 시 재정렬 버튼만 노출
  if (sortFailed) return (
    <div className="mt-2 px-3 py-2.5 rounded-2xl rounded-tl-sm border border-yellow-200 dark:border-yellow-500/20 bg-yellow-50 dark:bg-yellow-500/10 flex items-center justify-between gap-2">
      <span className="text-xs text-yellow-700 dark:text-yellow-400">장소는 추가됐지만 정렬에 실패했어요.</span>
      <button
        onClick={() => void handleRetrySort()}
        className="flex-shrink-0 text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] hover:underline"
      >
        다시 정렬
      </button>
    </div>
  );

  return (
    <div className="mt-2 rounded-2xl rounded-tl-sm overflow-hidden border border-[#DBEAFE] dark:border-[#2563EB]/20 bg-white dark:bg-[#1e2a3a]">
      {/* 장소 목록 */}
      <div className="px-3 pt-3 pb-2 space-y-1.5">
        {action.places.map((place, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs text-[#0f172a] dark:text-white/80 bg-[#EFF6FF] dark:bg-[#2563EB]/10 px-2.5 py-1.5 rounded-lg"
          >
            <MapPin size={10} className="text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0" />
            <span className="font-medium">{getActionPlaceName(place)}</span>
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
              disabled={adding || !selectedDate}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
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
          // 비순서 리스트 — 커스텀 dot 마커
          ul: ({ children }) => (
            <ul className="mt-1.5 space-y-1 pl-1 list-none">{children}</ul>
          ),
          // 순서 리스트 — 번호 마커 (네이티브 decimal 유지, li는 block으로 표시)
          ol: ({ children }) => (
            <ol className="mt-1.5 space-y-0.5 pl-5 list-decimal marker:text-[#2563EB]/60 dark:marker:text-[#60A5FA]/60">{children}</ol>
          ),
          // ul → dot 마커 / ol → 번호는 부모(ol)가 처리하므로 텍스트만
          li: ({ children, ...rest }) => {
            const ordered = (rest as { ordered?: boolean }).ordered;
            if (ordered) {
              return <li className="text-xs leading-relaxed">{children}</li>;
            }
            return (
              <li className="flex items-start gap-1.5 text-xs list-none">
                <span className="mt-1 w-1 h-1 rounded-full bg-[#2563EB]/50 dark:bg-[#60A5FA]/50 flex-shrink-0" />
                <span>{children}</span>
              </li>
            );
          },
          // 단락 — 기본 여백
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

const SESSION_KEY = 'planit-ai-chat';
const INITIAL_MESSAGE = (city: string): Message => ({
  role: 'ai',
  text: city
    ? `**${city}** 여행 도우미예요.\n일정 추천이나 여행 팁을 물어보세요!`
    : '여행지를 선택하면 맞춤 도움을 드릴 수 있어요. 일정 페이지 상단에서 도시를 먼저 설정해주세요!',
});

const QUICK_REPLIES = [
  { label: '📍 맛집 추천', text: '맛집 추천해줘' },
  { label: '🗺 하루 코스', text: '하루 코스 짜줘' },
  { label: '🏛 관광 명소', text: '꼭 가봐야 할 관광 명소 알려줘' },
  { label: '☕ 카페 추천', text: '분위기 좋은 카페 추천해줘' },
];

export default function AiChatPanel({ city }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    // sessionStorage에서 이전 대화 복원 — 도시가 같을 때만 적용
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { city: string; messages: Message[] };
          if (saved.city === city && saved.messages.length > 0) return saved.messages;
        }
      } catch {
        // 파싱 실패 시 초기 메시지로 시작
      }
    }
    return [INITIAL_MESSAGE(city)];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dayPlans = usePlanStore((s) => s.dayPlans);

  // 메시지 변경 시 sessionStorage에 저장
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ city, messages }));
    } catch {
      // 용량 초과 등 저장 실패 무시
    }
  }, [city, messages]);

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
    const lightDays = dayPlans.filter((dp) => dp.places.filter((p) => !p.slotType).length < 3 && dp.places.filter((p) => !p.slotType).length > 0);
    const totalDays = dayPlans.length;

    let hint = '';
    if (emptyDays.length === totalDays) {
      hint = `**${city}** ${totalDays}일 일정이 아직 비어있어요.\n어떤 스타일의 여행을 원하시나요? 맛집·관광지·쇼핑 위주로 알려주시면 코스를 추천해드릴게요! 🗺`;
    } else if (emptyDays.length > 0) {
      const labels = emptyDays.map((dp) => {
        const idx = dayPlans.indexOf(dp) + 1;
        return `**Day ${idx}**`;
      }).join(', ');
      hint = `${labels} 일정이 비어있어요. 해당 날짜에 추가할 장소를 추천해드릴까요? 😊`;
    } else if (lightDays.length > 0) {
      const idx = dayPlans.indexOf(lightDays[0]) + 1;
      hint = `**Day ${idx}** 일정이 조금 가볍네요. 근처 맛집이나 카페를 더 추가할까요? ☕`;
    }

    if (hint) {
      setMessages((prev) => [...prev, { role: 'ai', text: hint }]);
    }
  }, [open, city, dayPlans, messages.length]);

  // handleSend와 handleQuickReply를 통합 — AbortController도 공통 적용
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const dayPlansPayload = dayPlans.map((dp) => ({
        date: dp.date,
        places: dp.places.filter((p) => !p.slotType).map((p) => p.name),
      }));
      // 초기 안내 메시지 제외, 최근 6턴만 전달 (토큰 절감)
      const historyPayload = messages.slice(1).slice(-6).map((m) => ({ role: m.role, text: m.text }));

      const res = await nestApi.post<{ reply: string; action?: ChatAction }>('/ai/chat', {
        message: trimmed,
        city,
        day_plans: dayPlansPayload,
        history: historyPayload,
      }, { signal: controller.signal });

      setMessages((prev) => [...prev, { role: 'ai', text: res.data.reply, action: res.data.action }]);
    } catch (err) {
      // 사용자가 직접 취소한 경우 에러 말풍선 표시 안 함
      if (err instanceof Error && err.name === 'CanceledError') return;
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: '일시적으로 응답하지 못했어요. 잠시 후 다시 시도해 주세요.', isError: true },
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleSend() {
    void sendMessage(input);
  }

  function handleCancel() {
    abortRef.current?.abort();
    setLoading(false);
    abortRef.current = null;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function handleReset() {
    const initial = INITIAL_MESSAGE(city);
    setMessages([initial]);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ city, messages: [initial] }));
    } catch {
      // 무시
    }
  }

  function handleQuickReply(text: string) {
    void sendMessage(text);
  }

  // 메시지가 초기 메시지 하나뿐일 때 빠른 질문 칩을 표시
  const showQuickReplies = messages.length === 1 && city && !loading;

  return (
    <>
      {/* 채팅 패널 */}
      {open && (
        <div
          className="absolute right-4 z-30 w-[320px] flex flex-col rounded-3xl shadow-2xl bg-white dark:bg-[#1c1c1e] border border-[#DBEAFE]/60 dark:border-white/8 overflow-hidden"
          style={{
            bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
            maxHeight: 'min(540px, calc(70vh - env(safe-area-inset-bottom, 0px)))',
            boxShadow: '0 8px 40px rgba(37,99,235,0.15), 0 2px 8px rgba(0,0,0,0.08)',
          }}
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
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleReset}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="대화 초기화"
                title="대화 초기화"
              >
                <RotateCcw size={13} className="text-white" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="채팅 닫기"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
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
                  ) : msg.isError ? (
                    <div className="max-w-[88%] px-3 py-2.5 rounded-2xl rounded-tl-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm leading-relaxed">
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

            {/* 빠른 질문 칩 — 초기 상태(메시지 1개)에서만 표시 */}
            {showQuickReplies && (
              <div className="flex flex-wrap gap-1.5 pl-8 pt-1">
                {QUICK_REPLIES.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleQuickReply(chip.text)}
                    className="text-[11px] px-2.5 py-1.5 rounded-full border border-[#DBEAFE] dark:border-[#2563EB]/30 bg-white dark:bg-[#252527] text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#2563EB]/10 transition-colors cursor-pointer font-medium"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

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
                placeholder={loading ? '응답 기다리는 중...' : '메시지를 입력하세요...'}
                maxLength={500}
                disabled={loading}
                className="flex-1 text-sm bg-transparent outline-none text-[#0f172a] dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25 disabled:cursor-not-allowed"
              />
              <button
                onClick={loading ? handleCancel : () => void handleSend()}
                disabled={!loading && !input.trim()}
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer flex-shrink-0 ${
                  loading
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#2563EB] disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:cursor-not-allowed'
                }`}
                aria-label={loading ? '응답 취소' : '메시지 전송'}
              >
                {loading ? <X size={12} className="text-white" /> : <Send size={12} className="text-white" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB — safe-area-inset-bottom으로 모바일 키보드 오버랩 방지 */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="AI 여행 도우미"
        className="absolute right-4 z-30 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] active:scale-95 text-white shadow-xl flex items-center justify-center transition-all cursor-pointer"
        style={{
          width: 52,
          height: 52,
          bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
        }}
        aria-label="AI 여행 도우미 열기"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>
    </>
  );
}
