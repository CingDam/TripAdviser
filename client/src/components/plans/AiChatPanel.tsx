'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Plus, Sparkles, RotateCcw, History, ChevronDown, Search, CloudSun, Wand2, ArrowLeftRight, GitCompare, ListChecks, Gauge, Route, Wallet } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { nestApi } from '@/config/api.config';
import usePlanStore, { DayPlan, GooglePlace } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';

type ChatActionPlace = { name: string; category?: string | null };

interface ChatAction {
  places: (ChatActionPlace | string)[];
  target_date?: string | null;
  remove_names?: string[];  // 교체 제안 시 제거 대상 장소명 목록
}

interface MessageContext {
  city?: string; // 해당 턴에서 언급된 도시 — ai-server conversation_city로 전달
}

// Agent loop의 단일 step — tool 호출 + 결과 요약
interface ThinkingStep {
  step: number;
  tool: string;
  label: string;        // "장소 검색 중", "날씨 확인 중" 등 한국어 라벨
  summary?: string;     // 완료 후 결과 요약 ("5곳 발견" 등)
  ok?: boolean;         // 완료 후 성공 여부
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  action?: ChatAction;
  isError?: boolean;
  followUps?: string[];  // AI 답변 후 팔로업 칩
  context?: MessageContext;
  timestamp?: string;   // HH:MM 형식
  thinkingSteps?: ThinkingStep[];  // Agent의 tool 호출 step들 — ThinkingBox로 표시
  thinkingMs?: number;             // 전체 thinking 소요 시간 (ms)
}

// 주요 여행 도시 목록 — 메시지에서 도시 언급 감지용 (국내+일본+동남아+유럽 주요 도시)
const CITY_KEYWORDS: string[] = [
  '서울', '부산', '제주', '경주', '전주', '강릉', '인천',
  '도쿄', '오사카', '교토', '후쿠오카', '나라', '삿포로', '나고야', '요코하마', '히로시마',
  '방콕', '싱가포르', '발리', '다낭', '하노이', '호치민', '쿠알라룸푸르', '세부',
  '파리', '로마', '바르셀로나', '런던', '암스테르담', '프라하', '빈', '베를린',
  '뉴욕', '라스베가스', '하와이', '오아후', '마우이',
  '시드니', '멜버른',
];

function detectCityInText(text: string): string {
  const lower = text.toLowerCase();
  // 단순 부분 문자열 매칭 — 조사가 붙어도("오사카에서", "교토는") 감지
  for (const city of CITY_KEYWORDS) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  return '';
}

// nearby 키워드 → 카테고리 매핑 — 메시지에서 감지 시 Places Nearby API 호출
const NEARBY_KEYWORD_MAP: { keywords: string[]; category: string }[] = [
  { keywords: ['맛집', '식당', '음식', '밥', '점심', '저녁', '먹을', '먹자', '뭐 먹', '레스토랑'], category: '식당' },
  { keywords: ['카페', '커피', '디저트', '케이크', '브런치'], category: '카페' },
  { keywords: ['관광', '명소', '볼거리', '관광지', '구경', '박물관', '미술관'], category: '관광지' },
  { keywords: ['쇼핑', '쇼핑몰', '백화점', '면세점', '마트', '시장'], category: '쇼핑' },
];

function detectNearbyCategory(text: string): string {
  const lower = text;
  for (const { keywords, category } of NEARBY_KEYWORD_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return '';
}

// 현재 일정 장소들의 중심 좌표 계산 (slotType 제외)
function calcCenterCoord(dayPlans: import('@/store/usePlanStore').DayPlan[]): { lat: number; lng: number } | null {
  const coords = dayPlans
    .flatMap((dp) => dp.places.filter((p) => !p.slotType))
    .map((p) => p.location)
    .filter((l) => l && l.lat !== 0 && l.lng !== 0);
  if (coords.length === 0) return null;
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
  return { lat, lng };
}

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

// Agent tool name → 아이콘 매핑 — ThinkingBox에 step별로 표시
function ToolIcon({ tool, size = 11 }: { tool: string; size?: number }) {
  if (tool === 'search_places') return <Search size={size} />;
  if (tool === 'get_weather') return <CloudSun size={size} />;
  if (tool === 'get_directions') return <Route size={size} />;
  if (tool === 'compare_places') return <GitCompare size={size} />;
  if (tool === 'get_trip_context') return <ListChecks size={size} />;
  if (tool === 'evaluate_day_balance') return <Gauge size={size} />;
  if (tool === 'estimate_budget') return <Wallet size={size} />;
  if (tool === 'propose_add_places') return <Wand2 size={size} />;
  if (tool === 'propose_replace_places') return <ArrowLeftRight size={size} />;
  return <Sparkles size={size} />;
}

// Agent의 tool 호출 진행 상황을 보여주는 박스 — 기본 접힘, 클릭 시 펼침
function ThinkingBox({ steps, ms, loading }: { steps: ThinkingStep[]; ms?: number; loading?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (steps.length === 0) return null;

  const summaryText = loading
    ? `${steps.length}개 단계 · 분석 중`
    : `${steps.length}개 단계${ms ? ` · ${(ms / 1000).toFixed(1)}s` : ''}`;

  return (
    <div className="w-full rounded-xl bg-[#EFF6FF]/60 dark:bg-white/[0.03] border border-[#DBEAFE] dark:border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#0f172a]/50 dark:text-zinc-400 hover:bg-[#DBEAFE]/30 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {loading ? (
            <Loader2 size={12} className="animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
          ) : (
            <Sparkles size={12} className="text-[#2563EB] dark:text-[#60A5FA]" />
          )}
          <span className="font-medium tracking-tight">{summaryText}</span>
        </span>
        <ChevronDown
          size={13}
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 pt-1.5 space-y-1.5 border-t border-[#DBEAFE] dark:border-white/[0.06]">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs leading-relaxed">
              <span className="mt-0.5 text-[#2563EB]/60 dark:text-[#60A5FA]/60 flex-shrink-0">
                <ToolIcon tool={s.tool} size={12} />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[#0f172a]/70 dark:text-zinc-300">{s.label}</span>
                {s.summary && (
                  <span className={`ml-1.5 ${s.ok === false ? 'text-red-500 dark:text-red-400' : 'text-[#0f172a]/40 dark:text-zinc-500'}`}>
                    · {s.summary}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 장소 추가 액션 카드
function ActionCard({ action, city, onDone }: { action: ChatAction; city: string; onDone: () => void }) {
  // Agent가 target_date를 지정한 경우 기본 선택 — 사용자가 변경 가능
  const [selectedDate, setSelectedDate] = useState(action.target_date ?? '');
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [sortFailed, setSortFailed] = useState(false);
  const [lastAddedPlaces, setLastAddedPlaces] = useState<{ places: GooglePlace[]; date: string } | null>(null);
  // 장소별 선택 상태 — 기본 전체 선택
  const [selectedPlaces, setSelectedPlaces] = useState<Set<number>>(
    () => new Set(action.places.map((_, i) => i))
  );
  const addAbortRef = useRef<AbortController | null>(null);
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const addPlaceToDayPlan = usePlanStore((s) => s.addPlaceToDayPlan);
  const removePlaceFromDayPlan = usePlanStore((s) => s.removePlaceFromDayPlan);
  const reorderDayPlan = usePlanStore((s) => s.reorderDayPlan);
  const { show } = useSnackbar();

  const availableDates = dayPlans.map((d) => d.date);
  // 교체 제안 여부 — remove_names가 있으면 diff 미리보기 표시
  const isReplace = !!(action.remove_names && action.remove_names.length > 0);

  function togglePlace(idx: number) {
    setSelectedPlaces((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function handleCancelAdd() {
    addAbortRef.current?.abort();
    addAbortRef.current = null;
    setAdding(false);
  }

  async function handleAdd() {
    if (!selectedDate || selectedPlaces.size === 0) return;
    const controller = new AbortController();
    addAbortRef.current = controller;
    setAdding(true);
    let added = 0;
    let failed = 0;
    const selectedDay = dayPlans.find((d) => d.date === selectedDate);
    let currentPlaces = selectedDay?.places ?? [];

    // 교체 제안인 경우 remove_names에 해당하는 장소들 먼저 제거
    if (isReplace && action.remove_names) {
      const removeSet = new Set(action.remove_names.map((n) => n.toLowerCase().trim()));
      const toRemove = currentPlaces.filter(
        (p) => !p.slotType && removeSet.has(p.name.toLowerCase().trim()),
      );
      for (const p of toRemove) {
        removePlaceFromDayPlan(selectedDate, p.place_id);
      }
      // 제거 후 currentPlaces 갱신 — 정렬 로직이 정확한 slot 위치를 잡으려면 필요
      currentPlaces = currentPlaces.filter((p) => !toRemove.includes(p));
    }

    const existingIds = new Set(currentPlaces.map((p) => p.place_id));
    const addedPlaces: GooglePlace[] = [];

    const placesToAdd = action.places.filter((_, i) => selectedPlaces.has(i));

    // 병렬 resolve — 순차 직렬 호출 시 장소당 1~2초씩 누적되는 대기 시간 단축
    const results = await Promise.allSettled(
      placesToAdd.map((place) => {
        const name = getActionPlaceName(place);
        const category = getActionPlaceCategory(place);
        return nestApi.post<GooglePlace | null>('/place-search/resolve', { name, city, category }, { signal: controller.signal })
          .then((res) => ({ res, category }));
      })
    );

    // 사용자가 취소한 경우 조용히 종료
    if (controller.signal.aborted) {
      setAdding(false);
      return;
    }

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { res, category } = result.value;
        if (res.data && !existingIds.has(res.data.place_id)) {
          const resolved = { ...res.data, rating: null, category: category ?? undefined };
          addPlaceToDayPlan(selectedDate, resolved);
          addedPlaces.push(resolved);
          existingIds.add(res.data.place_id);
          added++;
        }
      } else {
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
          // 일반 장소가 없던 날(슬롯만)은 applyTripConfig 배치 로직과 동일하게 dayIndex 기준 분리
          const firstNormalIdx = currentPlaces.findIndex((p) => !p.slotType);
          const lastNormalIdx = currentPlaces.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
          let beforeSlots: typeof currentPlaces;
          let afterSlots: typeof currentPlaces;
          if (firstNormalIdx === -1) {
            const dayIndex = dayPlans.findIndex((d) => d.date === selectedDate);
            const isFirst = dayIndex === 0;
            const isLast = dayIndex === dayPlans.length - 1;
            if (isFirst) {
              beforeSlots = currentPlaces.filter((p) => p.slotType === 'airport_depart' || p.slotType === 'airport_arrive');
              afterSlots = currentPlaces.filter((p) => p.slotType === 'hotel');
            } else if (isLast) {
              beforeSlots = currentPlaces.filter((p) => p.slotType === 'hotel');
              afterSlots = currentPlaces.filter((p) => p.slotType === 'airport_arrive');
            } else {
              const hotelSlots = currentPlaces.filter((p) => p.slotType === 'hotel');
              beforeSlots = hotelSlots.slice(0, 1);
              afterSlots = hotelSlots.slice(1);
            }
          } else {
            beforeSlots = currentPlaces.slice(0, firstNormalIdx).filter((p) => p.slotType);
            afterSlots = lastNormalIdx === -1 ? [] : currentPlaces.slice(lastNormalIdx + 1).filter((p) => p.slotType);
          }
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
      const retryDate = lastAddedPlaces.date;
      const retryDay = dayPlans.find((d) => d.date === retryDate);
      const retryPlaces = retryDay?.places ?? [];
      const retryFirstNormal = retryPlaces.findIndex((p) => !p.slotType);
      const retryLastNormal = retryPlaces.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
      const retryBefore = retryFirstNormal === -1 ? [] : retryPlaces.slice(0, retryFirstNormal).filter((p) => p.slotType);
      const retryAfter = retryLastNormal === -1 ? [] : retryPlaces.slice(retryLastNormal + 1).filter((p) => p.slotType);
      reorderDayPlan(retryDate, [...retryBefore, ...sorted, ...retryAfter]);
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
    <div className="w-full px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.08] flex items-center justify-between gap-2">
      <span className="text-xs text-amber-800 dark:text-amber-300">장소는 추가됐지만 정렬에 실패했어요.</span>
      <button
        onClick={() => void handleRetrySort()}
        className="flex-shrink-0 text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline"
      >
        다시 정렬
      </button>
    </div>
  );

  return (
    <div className="w-full rounded-xl overflow-hidden border border-[#DBEAFE] dark:border-white/[0.08] bg-white dark:bg-white/[0.02]">
      {/* 교체 제안: diff 미리보기 */}
      {isReplace && action.remove_names && action.remove_names.length > 0 && (
        <div className="px-3.5 pt-3 pb-1">
          <p className="text-[11px] text-[#0f172a]/50 dark:text-zinc-500 mb-1.5 font-medium">
            기존 장소 {action.remove_names.length}곳 제거
          </p>
          <div className="space-y-1 mb-2.5">
            {action.remove_names.map((name, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/[0.08] border border-red-100 dark:border-red-500/20"
              >
                <X size={11} className="text-red-500 dark:text-red-400 flex-shrink-0" strokeWidth={2.5} />
                <span className="text-red-700 dark:text-red-300 line-through truncate">{name}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#2563EB] dark:text-[#60A5FA] font-medium mb-1">
            <ArrowLeftRight size={11} strokeWidth={2} />
            <span>아래 장소로 교체</span>
          </div>
        </div>
      )}
      {/* 장소 목록 */}
      <div className="px-3.5 pt-3 pb-2 space-y-1.5">
        <p className="text-[11px] text-[#0f172a]/50 dark:text-zinc-500 mb-1 font-medium">
          추가할 장소 ({selectedPlaces.size}/{action.places.length})
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
              className={`w-full flex items-center gap-2.5 text-[13px] px-3 py-2 rounded-lg transition-all cursor-pointer text-left ${
                isSelected
                  ? 'bg-[#EFF6FF]/60 dark:bg-white/[0.04] border border-[#DBEAFE] dark:border-white/[0.1]'
                  : 'bg-transparent border border-transparent opacity-50 hover:opacity-75'
              }`}
            >
              <div className={`w-[18px] h-[18px] rounded-md flex-shrink-0 flex items-center justify-center border transition-all ${
                isSelected
                  ? 'bg-[#2563EB] dark:bg-[#3B82F6] border-[#2563EB] dark:border-[#3B82F6]'
                  : 'border-[#DBEAFE] dark:border-white/[0.15]'
              }`}>
                {isSelected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
              </div>
              <span className="text-base leading-none">{emoji}</span>
              <span className="font-medium text-[#0f172a] dark:text-zinc-100 flex-1 truncate tracking-tight">{name}</span>
              {category && (
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-white/[0.06] text-[#2563EB] dark:text-[#60A5FA] font-medium">
                  {category}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 날짜 선택 + 액션 버튼 */}
      <div className="px-3.5 pb-3 pt-1 space-y-2.5">
        {availableDates.length > 0 ? (
          <>
            <p className="text-[11px] text-[#0f172a]/50 dark:text-zinc-500 font-medium">어느 날 추가할까요?</p>
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
                    className={`flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563EB] dark:bg-[#3B82F6] border-[#2563EB] dark:border-[#3B82F6] text-white'
                        : 'bg-white dark:bg-transparent border-[#DBEAFE] dark:border-white/[0.1] text-[#0f172a]/70 dark:text-zinc-300 hover:border-[#2563EB]/30 dark:hover:border-white/[0.16]'
                    }`}
                  >
                    <span className="font-semibold leading-none tracking-tight">Day {i + 1}</span>
                    <span className={`text-[10px] mt-1 leading-none ${isSelected ? 'opacity-70' : 'text-[#0f172a]/40 dark:text-zinc-500'}`}>
                      {isEmpty ? '비어있음' : `${normalCount}곳`}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={() => void handleAdd()}
                disabled={adding || !selectedDate || selectedPlaces.size === 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#2563EB] dark:bg-[#3B82F6] hover:bg-[#1D4ED8] dark:hover:bg-[#60A5FA] disabled:bg-[#DBEAFE] dark:disabled:bg-white/[0.06] disabled:text-[#2563EB]/40 dark:disabled:text-zinc-600 text-white text-[13px] font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed tracking-tight"
              >
                {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} strokeWidth={2.5} />}
                {adding ? '추가 중' : `${selectedPlaces.size}개 추가`}
              </button>
              {adding && (
                <button
                  onClick={handleCancelAdd}
                  className="flex items-center justify-center px-3 py-2.5 rounded-lg bg-[#EFF6FF] dark:bg-white/[0.06] hover:bg-[#DBEAFE] dark:hover:bg-white/[0.1] text-[#2563EB] dark:text-zinc-300 transition-all active:scale-[0.98] cursor-pointer"
                  aria-label="추가 취소"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-center text-[#0f172a]/30 dark:text-zinc-600 py-2">
            먼저 여행 날짜를 설정해주세요.
          </p>
        )}
      </div>
    </div>
  );
}

function AiBubble({ text }: { text: string }) {
  return (
    <div className="w-full text-[#0f172a]/80 dark:text-zinc-200 text-[14px] leading-[1.65] tracking-tight">
      <ReactMarkdown
        components={{
          strong: ({ children }) => (
            <strong className="font-semibold text-[#0f172a] dark:text-zinc-100">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="mt-2 space-y-1 pl-1 list-none">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-2 space-y-1 pl-5 list-decimal marker:text-[#2563EB]/40 dark:marker:text-zinc-500">{children}</ol>
          ),
          li: ({ children, ...rest }) => {
            const ordered = (rest as { ordered?: boolean }).ordered;
            if (ordered) {
              return <li className="text-[14px] leading-[1.65]">{children}</li>;
            }
            return (
              <li className="flex items-start gap-2 text-[14px] list-none leading-[1.65]">
                <span className="mt-[9px] w-1 h-1 rounded-full bg-[#2563EB]/30 dark:bg-zinc-500 flex-shrink-0" />
                <span>{children}</span>
              </li>
            );
          },
          p: ({ children }) => <p className="leading-[1.65]">{children}</p>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

const SESSION_KEY = 'planit-ai-chat';

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const INITIAL_MESSAGE = (city: string): Message => ({
  role: 'ai',
  text: city
    ? `**${city}** 여행 도우미예요.\n일정 추천이나 여행 팁을 물어보세요!`
    : '여행지를 선택하면 맞춤 도움을 드릴 수 있어요. 일정 페이지 상단에서 도시를 먼저 설정해주세요!',
  timestamp: nowHHMM(),
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

export default function AiChatPanel({ city, mode = 'sidebar' }: Props) {
  const isFullpage = mode === 'fullpage';
  const [open, setOpen] = useState(isFullpage);

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
  // 히스토리 접기 — true면 초기 메시지(index 0)를 제외한 이전 대화를 숨김
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
      setMessages((prev) => [...prev, { role: 'ai', text: hint, timestamp: nowHHMM() }]);
    }
  }, [open, city, dayPlans, messages.length]);

  // handleSend와 handleQuickReply를 통합 — SSE 스트리밍으로 토큰 단위 렌더링
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // 사용자 메시지에서 도시명 감지 — conversation_city 추적용
    const detectedCity = detectCityInText(trimmed);
    const userMsg: Message = {
      role: 'user',
      text: trimmed,
      timestamp: nowHHMM(),
      ...(detectedCity ? { context: { city: detectedCity } } : {}),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    streamingTextRef.current = '';

    const controller = new AbortController();
    abortRef.current = controller;

    // 좌표를 함께 보내야 get_directions tool이 Haversine 거리·시간을 추정할 수 있음
    const dayPlansPayload = dayPlans.map((dp) => ({
      date: dp.date,
      places: dp.places.filter((p) => !p.slotType).map((p) => ({
        name: p.name,
        lat: p.location?.lat,
        lng: p.location?.lng,
      })),
    }));
    // 초기 안내 메시지 제외, 최근 20턴 전달 — ai-server가 7번째 이전 턴은 요약해 system에 압축
    const historyPayload = [...messages.slice(1), userMsg].slice(-20).map((m) => ({
      role: m.role,
      text: m.text,
      ...(m.context?.city ? { context: { city: m.context.city } } : {}),
    }));
    const messageWithStyle = travelStyle
      ? `[여행 스타일: ${travelStyle}] ${trimmed}`
      : trimmed;

    // 근처 장소 키워드 감지 → Places Nearby API 실시간 조회 후 컨텍스트로 주입
    const nearbyCategory = detectNearbyCategory(trimmed);
    let nearbyPlaces: { name: string; formatted_address: string; rating?: number; user_ratings_total?: number; price_level?: number }[] = [];
    if (nearbyCategory) {
      const center = calcCenterCoord(dayPlans);
      if (center) {
        try {
          const nearbyRes = await nestApi.post<{ place_id: string; name: string; formatted_address: string; rating?: number; user_ratings_total?: number; price_level?: number }[]>(
            '/place-search/nearby',
            { lat: center.lat, lng: center.lng, category: nearbyCategory },
          );
          nearbyPlaces = (nearbyRes.data ?? []).map(({ name, formatted_address, rating, user_ratings_total, price_level }) => ({
            name, formatted_address, rating, user_ratings_total, price_level,
          }));
        } catch {
          // nearby 조회 실패 시 AI가 학습 데이터로 fallback — 사용자 응답은 계속 진행
        }
      }
    }

    const nestUrl = process.env.NEXT_PUBLIC_NEST_URL ?? 'http://localhost:3001';
    // Agent의 search_places·get_weather tool에 주입할 일정 중심 좌표
    const center = calcCenterCoord(dayPlans);
    // 매 응답마다 thinking step·시작시각을 별도 ref에 누적 — 메시지 객체보다 빠른 업데이트용
    const thinkingStepsRef: ThinkingStep[] = [];
    const thinkingStartedAt = Date.now();

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
          ...(nearbyPlaces.length > 0 ? { nearby_places: nearbyPlaces, nearby_category: nearbyCategory } : {}),
          ...(center ? { center_lat: center.lat, center_lng: center.lng } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // 첫 토큰 수신 시에만 메시지를 삽입 — 이전에 삽입하면 빈 말풍선이 표시됨
      let streamingStarted = false;

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
            const event = JSON.parse(raw) as {
              type: string; text?: string; reply?: string; action?: ChatAction; message?: string;
              step?: number; tool?: string; label?: string; summary?: string; ok?: boolean;
            };

            if (event.type === 'thinking' && event.tool && event.label) {
              // 새 step 추가 — placeholder 메시지 없으면 먼저 만들어 thinkingSteps 표시
              const newStep: ThinkingStep = { step: event.step ?? thinkingStepsRef.length + 1, tool: event.tool, label: event.label };
              thinkingStepsRef.push(newStep);
              if (!streamingStarted) {
                streamingStarted = true;
                setMessages((prev) => [...prev, { role: 'ai', text: '', thinkingSteps: [...thinkingStepsRef] }]);
              } else {
                setMessages((prev) =>
                  prev.map((m, idx) => idx === prev.length - 1 ? { ...m, thinkingSteps: [...thinkingStepsRef] } : m)
                );
              }
            } else if (event.type === 'thinking_result') {
              // 마지막 step에 결과 채움
              const last = thinkingStepsRef[thinkingStepsRef.length - 1];
              if (last) {
                last.summary = event.summary;
                last.ok = event.ok;
              }
              setMessages((prev) =>
                prev.map((m, idx) => idx === prev.length - 1 ? { ...m, thinkingSteps: [...thinkingStepsRef] } : m)
              );
            } else if (event.type === 'token' && event.text) {
              // 첫 토큰 수신 시 AI 메시지 자리 삽입 — 텍스트가 있을 때만 말풍선 생성
              if (!streamingStarted) {
                streamingStarted = true;
                setMessages((prev) => [...prev, { role: 'ai', text: event.text! }]);
                streamingTextRef.current = event.text;
              } else {
                streamingTextRef.current += event.text;
                const accumulated = streamingTextRef.current;
                setMessages((prev) =>
                  prev.map((m, idx) => idx === prev.length - 1 ? { ...m, text: accumulated } : m)
                );
              }
            } else if (event.type === 'done') {
              const finalReply = event.reply ?? streamingTextRef.current;
              const followUps = buildFollowUpChips(finalReply, !!event.action);
              const ts = nowHHMM();
              const thinkingMs = thinkingStepsRef.length > 0 ? Date.now() - thinkingStartedAt : undefined;
              if (streamingStarted) {
                // 스트리밍 자리 메시지를 최종 완성본으로 교체
                setMessages((prev) =>
                  prev.map((m, idx) =>
                    idx === prev.length - 1
                      ? { ...m, text: finalReply, action: event.action, followUps, timestamp: ts, thinkingMs }
                      : m
                  )
                );
              } else {
                // token 없이 done만 온 경우 (action JSON 응답) — 메시지 신규 삽입
                streamingStarted = true;
                setMessages((prev) => [
                  ...prev,
                  { role: 'ai', text: finalReply, action: event.action, followUps, timestamp: ts, thinkingMs },
                ]);
              }
            } else if (event.type === 'error') {
              const errMsg: Message = { role: 'ai', text: event.message ?? '응답 중 오류가 발생했어요.', isError: true };
              if (streamingStarted) {
                setMessages((prev) =>
                  prev.map((m, idx) =>
                    idx === prev.length - 1 ? { ...m, ...errMsg } : m
                  )
                );
              } else {
                streamingStarted = true;
                setMessages((prev) => [...prev, errMsg]);
              }
            }
          } catch {
            // 잘못된 SSE 이벤트는 무시
          }
        }
      }
    } catch (err) {
      // 사용자가 직접 취소한 경우 에러 말풍선 표시 안 함
      if (err instanceof Error && err.name === 'AbortError') {
        // 취소 시 부분 스트리밍된 메시지가 있으면 그대로 유지 (이미 텍스트 있음)
      } else {
        const errMsg: Message = { role: 'ai', text: '일시적으로 응답하지 못했어요. 잠시 후 다시 시도해 주세요.', isError: true };
        setMessages((prev) => [...prev, errMsg]);
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 전송, Shift+Enter 줄바꿈 — IME 조합 중(isComposing)엔 전송 차단
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function handleReset() {
    const initial = INITIAL_MESSAGE(city);
    setMessages([initial]);
    setTravelStyle(null);
    setHistoryCollapsed(true);
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

  const panelVisible = isFullpage || open;

  return (
    <>
      {/* 사이드시트(sidebar) 또는 탭 전체(fullpage) — Linear/Vercel 스타일 중성 톤
          sidebar: absolute 우측 사이드시트 (min(420px, 92vw))
          fullpage: relative 전체 영역 (모바일 AI 탭 전용) */}
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
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end max-w-[85%]' : 'items-start w-full'}`}>
                  {msg.role === 'ai' && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                    <ThinkingBox
                      steps={msg.thinkingSteps}
                      ms={msg.thinkingMs}
                      loading={loading && i === messages.length - 1 && !msg.text}
                    />
                  )}

                  {msg.role === 'user' ? (
                    // 유저 메시지 — 브랜드 블루 배경에 흰 텍스트
                    <div className="px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#2563EB] dark:bg-[#3B82F6] text-white text-[14px] leading-[1.55] tracking-tight">
                      {msg.text}
                    </div>
                  ) : msg.isError ? (
                    <div className="w-full px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/40 text-red-700 dark:text-red-300 text-[13px] leading-[1.6]">
                      {msg.text}
                    </div>
                  ) : msg.text ? (
                    <AiBubble text={msg.text} />
                  ) : null}

                  {msg.timestamp && (
                    <span className="text-[10px] text-[#0f172a]/30 dark:text-zinc-600 px-0.5 leading-none">
                      {msg.timestamp}
                    </span>
                  )}

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
                            { role: 'ai', text: `**${chip.label}** 스타일로 설정했어요.\n여행 날짜를 먼저 설정하면 해당 스타일에 맞는 장소를 바로 추천해드릴게요.` },
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

            {loading && (
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
                onClick={loading ? handleCancel : () => void handleSend()}
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

      {/* FAB — sidebar 모드에서만 표시. fullpage 모드는 탭바로 접근 */}
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
