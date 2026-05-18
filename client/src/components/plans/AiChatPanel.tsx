'use client';
import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Plus, Sparkles, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { nestApi } from '@/config/api.config';
import usePlanStore, { DayPlan, GooglePlace } from '@/store/usePlanStore';
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
  followUps?: string[];  // AI 답변 후 팔로업 칩
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

// 카테고리 → 이모지 매핑
const CATEGORY_EMOJI: Record<string, string> = {
  관광지: '🏛',
  식당: '🍜',
  카페: '☕',
  쇼핑: '🛍',
  자연: '🌿',
  문화: '🎭',
  호텔: '🏨',
  바: '🍻',
  교통: '🚆',
};

// 장소 추가 액션 카드
function ActionCard({ action, city, onDone }: { action: ChatAction; city: string; onDone: () => void }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [sortFailed, setSortFailed] = useState(false);
  const [lastAddedPlaces, setLastAddedPlaces] = useState<{ places: GooglePlace[]; date: string } | null>(null);
  // 장소별 선택 상태 — 기본 전체 선택
  const [selectedPlaces, setSelectedPlaces] = useState<Set<number>>(
    () => new Set(action.places.map((_, i) => i))
  );
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const addPlaceToDayPlan = usePlanStore((s) => s.addPlaceToDayPlan);
  const reorderDayPlan = usePlanStore((s) => s.reorderDayPlan);
  const { show } = useSnackbar();

  const availableDates = dayPlans.map((d) => d.date);

  function togglePlace(idx: number) {
    setSelectedPlaces((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function handleAdd() {
    if (!selectedDate || selectedPlaces.size === 0) return;
    setAdding(true);
    let added = 0;
    let failed = 0;
    const selectedDay = dayPlans.find((d) => d.date === selectedDate);
    const currentPlaces = selectedDay?.places ?? [];
    const existingIds = new Set(currentPlaces.map((p) => p.place_id));
    const addedPlaces: GooglePlace[] = [];

    const placesToAdd = action.places.filter((_, i) => selectedPlaces.has(i));

    for (const place of placesToAdd) {
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
          // slotType 위치 기준: currentPlaces(추가 전)의 슬롯 앞/뒤 분리
          // 슬롯이 없으면 before/after 모두 빈 배열 — 슬롯 유실 없음
          const slotOnly = currentPlaces.filter((p) => p.slotType);
          const firstNormalIdx = currentPlaces.findIndex((p) => !p.slotType);
          const lastNormalIdx = currentPlaces.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
          const beforeSlots = firstNormalIdx === -1 ? [] : currentPlaces.slice(0, firstNormalIdx).filter((p) => p.slotType);
          const afterSlots = lastNormalIdx === -1 ? slotOnly : currentPlaces.slice(lastNormalIdx + 1).filter((p) => p.slotType);
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
      {/* 장소 목록 — 체크박스로 개별 선택/제외 */}
      <div className="px-3 pt-3 pb-2 space-y-1.5">
        <p className="text-[10px] text-[#0f172a]/40 dark:text-white/30 mb-1">
          추가할 장소를 선택하세요 ({selectedPlaces.size}/{action.places.length})
        </p>
        {action.places.map((place, i) => {
          const name = getActionPlaceName(place);
          const category = getActionPlaceCategory(place);
          const emoji = category ? (CATEGORY_EMOJI[category] ?? '📍') : '📍';
          const isSelected = selectedPlaces.has(i);
          return (
            <button
              key={i}
              onClick={() => togglePlace(i)}
              className={`w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-xl transition-all cursor-pointer text-left ${
                isSelected
                  ? 'bg-[#EFF6FF] dark:bg-[#2563EB]/15 border border-[#DBEAFE] dark:border-[#2563EB]/30'
                  : 'bg-[#F8FAFF] dark:bg-white/5 border border-transparent opacity-50'
              }`}
            >
              {/* 체크 표시 */}
              <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border transition-all ${
                isSelected
                  ? 'bg-[#2563EB] border-[#2563EB]'
                  : 'border-[#DBEAFE] dark:border-white/20'
              }`}>
                {isSelected && <span className="text-white text-[8px] font-bold">✓</span>}
              </div>
              {/* 카테고리 이모지 */}
              <span className="text-sm leading-none">{emoji}</span>
              <span className="font-medium text-[#0f172a] dark:text-white/80 flex-1 truncate">{name}</span>
              {/* 카테고리 배지 */}
              {category && (
                <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-white dark:bg-white/10 text-[#0f172a]/50 dark:text-white/40 border border-[#DBEAFE]/60 dark:border-white/10">
                  {category}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 날짜 선택 — 시각적 Day 카드 */}
      <div className="px-3 pb-3 space-y-2">
        {availableDates.length > 0 ? (
          <>
            <p className="text-[10px] text-[#0f172a]/40 dark:text-white/30">어느 날 추가할까요?</p>
            <div className="flex flex-wrap gap-1.5">
              {availableDates.map((date, i) => {
                const dp = dayPlans[i];
                const normalCount = dp.places.filter((p) => !p.slotType).length;
                const isEmpty = normalCount === 0;
                const isSelected = selectedDate === date;
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center px-3 py-2 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563EB] border-[#2563EB] text-white'
                        : isEmpty
                        ? 'bg-[#EFF6FF] dark:bg-[#2563EB]/10 border-[#DBEAFE] dark:border-[#2563EB]/30 text-[#2563EB] dark:text-[#60A5FA]'
                        : 'bg-white dark:bg-white/5 border-[#DBEAFE]/60 dark:border-white/10 text-[#0f172a]/60 dark:text-white/50'
                    }`}
                  >
                    <span className="font-bold leading-none">Day {i + 1}</span>
                    <span className={`text-[9px] mt-0.5 leading-none ${isSelected ? 'text-white/70' : 'opacity-60'}`}>
                      {isEmpty ? '비어있음' : `${normalCount}곳`}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => void handleAdd()}
              disabled={adding || !selectedDate || selectedPlaces.size === 0}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {adding ? '추가 중...' : `선택 장소 ${selectedPlaces.size}개 추가하기`}
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

// 일정 상태를 분석해 현재 상황에 맞는 빠른 질문 칩 생성
function buildContextChips(dayPlans: DayPlan[], city: string): { label: string; text: string }[] {
  if (!city) return [];

  const chips: { label: string; text: string }[] = [];
  const normalPlaces = (dp: DayPlan) =>
    dp.places.filter((p) => !p.slotType);

  const emptyDays = dayPlans.filter((dp) => normalPlaces(dp).length === 0);
  const lightDays = dayPlans.filter((dp) => {
    const n = normalPlaces(dp).length;
    return n > 0 && n < 3;
  });
  const hasPlans = dayPlans.some((dp) => normalPlaces(dp).length > 0);

  // 비어있는 특정 날짜가 있으면 해당 날 코스 짜기 칩
  if (emptyDays.length > 0 && emptyDays.length < dayPlans.length) {
    const idx = dayPlans.indexOf(emptyDays[0]) + 1;
    chips.push({ label: `📅 Day ${idx} 코스`, text: `Day ${idx} 하루 코스 짜줘` });
  }

  // 일정이 전혀 없으면 전체 코스 칩
  if (emptyDays.length === dayPlans.length && dayPlans.length > 0) {
    chips.push({ label: '🗺 전체 코스', text: '여행 코스 짜줘' });
  }

  // 일정이 있는 날 맛집 추천
  if (hasPlans) {
    chips.push({ label: '🍜 맛집 추천', text: '근처 맛집 추천해줘' });
  } else {
    chips.push({ label: '📍 맛집 추천', text: '맛집 추천해줘' });
  }

  // 가벼운 날이 있으면 추가 장소 제안
  if (lightDays.length > 0) {
    const idx = dayPlans.indexOf(lightDays[0]) + 1;
    chips.push({ label: `➕ Day ${idx} 더 채우기`, text: `Day ${idx}에 추가할 장소 추천해줘` });
  }

  // 기본 칩들
  if (chips.length < 3) chips.push({ label: '🏛 관광 명소', text: '꼭 가봐야 할 관광 명소 알려줘' });
  if (chips.length < 4) chips.push({ label: '☕ 카페 추천', text: '분위기 좋은 카페 추천해줘' });

  return chips.slice(0, 4);
}

// AI 답변 키워드를 분석해 팔로업 칩 생성
function buildFollowUpChips(reply: string, hasAction: boolean): string[] {
  if (hasAction) {
    // 장소 추가 액션 후 — 해당 날짜 정렬·주변 장소 제안
    return ['주변 카페도 추천해줘', '이 코스 교통 팁 알려줘'];
  }

  const lower = reply.toLowerCase();
  const followUps: string[] = [];

  if (lower.includes('맛집') || lower.includes('식당') || lower.includes('음식')) {
    followUps.push('일정에 추가해줘');
    followUps.push('카페도 추천해줘');
  } else if (lower.includes('관광') || lower.includes('명소') || lower.includes('박물관')) {
    followUps.push('일정에 추가해줘');
    followUps.push('근처 맛집도 추천해줘');
  } else if (lower.includes('카페') || lower.includes('디저트')) {
    followUps.push('일정에 추가해줘');
    followUps.push('맛집도 같이 추천해줘');
  } else if (lower.includes('교통') || lower.includes('이동') || lower.includes('버스') || lower.includes('지하철')) {
    followUps.push('가성비 좋은 방법은?');
    followUps.push('이동 시간 얼마나 걸려?');
  } else if (lower.includes('날씨') || lower.includes('기후') || lower.includes('계절')) {
    followUps.push('그럼 뭘 챙겨가야 해?');
    followUps.push('실내 관광지 추천해줘');
  }

  if (followUps.length === 0) {
    followUps.push('더 자세히 알려줘');
    followUps.push('다른 추천도 있어?');
  }

  return followUps.slice(0, 2);
}

const STYLE_CHIPS = [
  { emoji: '🍜', label: '맛집 위주', value: '맛집 위주' },
  { emoji: '🏛', label: '문화·관광', value: '문화·역사·관광지 위주' },
  { emoji: '🛍', label: '쇼핑', value: '쇼핑 위주' },
  { emoji: '🌿', label: '자연·힐링', value: '자연·힐링 위주' },
  { emoji: '🎉', label: '액티비티', value: '액티비티·체험 위주' },
  { emoji: '☕', label: '카페 투어', value: '카페 투어 위주' },
];

export default function AiChatPanel({ city }: Props) {
  const [open, setOpen] = useState(false);

  // sessionStorage에서 초기값 함께 복원
  const [{ initialMessages, initialStyle }] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { city: string; messages: Message[]; style?: string };
          if (saved.city === city && saved.messages.length > 0) {
            return { initialMessages: saved.messages, initialStyle: saved.style ?? null };
          }
        }
      } catch { /* 파싱 실패 시 초기값 */ }
    }
    return { initialMessages: [INITIAL_MESSAGE(city)], initialStyle: null };
  });

  // 선택된 여행 스타일 — 이후 AI 요청 시 컨텍스트로 추가
  const [travelStyle, setTravelStyle] = useState<string | null>(initialStyle);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 스트리밍 중 부분 텍스트 누적 — SSE 토큰 단위 업데이트용
  const streamingTextRef = useRef('');
  const dayPlans = usePlanStore((s) => s.dayPlans);

  // 메시지·스타일 변경 시 sessionStorage에 저장
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ city, messages, style: travelStyle }));
    } catch {
      // 용량 초과 등 저장 실패 무시
    }
  }, [city, messages, travelStyle]);

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

  // handleSend와 handleQuickReply를 통합 — SSE 스트리밍으로 토큰 단위 렌더링
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);
    streamingTextRef.current = '';

    const controller = new AbortController();
    abortRef.current = controller;

    const dayPlansPayload = dayPlans.map((dp) => ({
      date: dp.date,
      places: dp.places.filter((p) => !p.slotType).map((p) => p.name),
    }));
    // 초기 안내 메시지 제외, 최근 6턴만 전달 (토큰 절감)
    const historyPayload = messages.slice(1).slice(-6).map((m) => ({ role: m.role, text: m.text }));
    const messageWithStyle = travelStyle
      ? `[여행 스타일: ${travelStyle}] ${trimmed}`
      : trimmed;

    const nestUrl = process.env.NEXT_PUBLIC_NEST_URL ?? 'http://localhost:3001';

    try {
      const res = await fetch(`${nestUrl}/api/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageWithStyle,
          city,
          day_plans: dayPlansPayload,
          history: historyPayload,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // 스트리밍 중 AI 메시지 자리를 먼저 추가 — 빈 텍스트로 시작
      setMessages((prev) => [...prev, { role: 'ai', text: '' }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw) as { type: string; text?: string; reply?: string; action?: ChatAction; message?: string };

            if (event.type === 'token' && event.text) {
              // 토큰을 누적하고 마지막 AI 메시지 텍스트를 업데이트
              streamingTextRef.current += event.text;
              const accumulated = streamingTextRef.current;
              setMessages((prev) =>
                prev.map((m, idx) => idx === prev.length - 1 ? { ...m, text: accumulated } : m)
              );
            } else if (event.type === 'done') {
              const finalReply = event.reply ?? streamingTextRef.current;
              const followUps = buildFollowUpChips(finalReply, !!event.action);
              setMessages((prev) =>
                prev.map((m, idx) =>
                  idx === prev.length - 1
                    ? { ...m, text: finalReply, action: event.action, followUps }
                    : m
                )
              );
            } else if (event.type === 'error') {
              setMessages((prev) =>
                prev.map((m, idx) =>
                  idx === prev.length - 1
                    ? { ...m, text: event.message ?? '응답 중 오류가 발생했어요.', isError: true }
                    : m
                )
              );
            }
          } catch {
            // 잘못된 SSE 이벤트는 무시
          }
        }
      }
    } catch (err) {
      // 사용자가 직접 취소한 경우 에러 말풍선 표시 안 함
      if (err instanceof Error && err.name === 'AbortError') {
        // 취소 시 스트리밍 중이던 빈 메시지 제거
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last?.role === 'ai' && !last.text ? prev.slice(0, -1) : prev;
        });
      } else {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          // 스트리밍 자리 메시지가 이미 있으면 교체, 없으면 추가
          const errMsg: Message = { role: 'ai', text: '일시적으로 응답하지 못했어요. 잠시 후 다시 시도해 주세요.', isError: true };
          if (last?.role === 'ai' && !last.text) return [...prev.slice(0, -1), errMsg];
          return [...prev, errMsg];
        });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      streamingTextRef.current = '';
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
    setTravelStyle(null);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ city, messages: [initial], style: null }));
    } catch {
      // 무시
    }
  }

  function handleQuickReply(text: string) {
    void sendMessage(text);
  }

  // 일정 상태 기반 동적 칩 — 초기 메시지 하나일 때만 표시
  const contextChips = buildContextChips(dayPlans, city);
  const showQuickReplies = messages.length === 1 && city && !loading;
  // 스타일 온보딩: 초기 상태이고 스타일 미선택이고 도시가 있을 때 표시
  const showStyleOnboarding = messages.length === 1 && city && !travelStyle && dayPlans.length === 0;

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
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white leading-none">AI 여행 도우미</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[10px] text-white/60">{city}</p>
                  {travelStyle && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 text-white/80 leading-none truncate max-w-[80px]">
                      {travelStyle.replace(' 위주', '')}
                    </span>
                  )}
                </div>
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

                  {/* 팔로업 칩 — 마지막 AI 메시지에만 표시 */}
                  {msg.role === 'ai' && msg.followUps && msg.followUps.length > 0 && i === messages.length - 1 && !loading && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {msg.followUps.map((text) => (
                        <button
                          key={text}
                          onClick={() => handleQuickReply(text)}
                          className="text-[11px] px-2.5 py-1.5 rounded-full border border-[#DBEAFE] dark:border-[#2563EB]/30 bg-white dark:bg-[#252527] text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#2563EB]/10 transition-colors cursor-pointer font-medium"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* 스타일 온보딩 — 일정 없고 스타일 미선택 시 표시 */}
            {showStyleOnboarding && (
              <div className="pl-8 pt-1 space-y-1.5">
                <p className="text-[11px] text-[#0f172a]/40 dark:text-white/30">어떤 여행 스타일인가요?</p>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      onClick={() => {
                        setTravelStyle(chip.value);
                        void sendMessage(`${chip.emoji} ${chip.label} 스타일로 여행할 거야. 추천해줘!`);
                      }}
                      className="text-[11px] px-2.5 py-1.5 rounded-full border border-[#DBEAFE] dark:border-[#2563EB]/30 bg-white dark:bg-[#252527] text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#2563EB]/10 transition-colors cursor-pointer font-medium"
                    >
                      {chip.emoji} {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 빠른 질문 칩 — 초기 상태(메시지 1개)에서 일정 기반 동적 생성 */}
            {showQuickReplies && !showStyleOnboarding && contextChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-8 pt-1">
                {contextChips.map((chip) => (
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
