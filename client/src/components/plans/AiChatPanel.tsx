'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, Plus, Sparkles, RotateCcw, History, ChevronDown, Search, CloudSun, Wand2, ArrowLeftRight, GitCompare, ListChecks, Gauge, Route, Wallet } from 'lucide-react';
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
    ? `${steps.length} step · 생각 중...`
    : `${steps.length} step${ms ? ` · ${(ms / 1000).toFixed(1)}초` : ''}`;

  return (
    <div className="w-full max-w-[88%] rounded-2xl bg-[#F0F4FF]/60 dark:bg-white/3 border border-[#DBEAFE]/40 dark:border-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-[#0f172a]/55 dark:text-white/40 hover:bg-[#EFF6FF] dark:hover:bg-white/5 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          {loading ? (
            <Loader2 size={11} className="animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
          ) : (
            <Sparkles size={11} className="text-[#2563EB] dark:text-[#60A5FA]" />
          )}
          <span className="font-medium">{summaryText}</span>
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-2 pt-1 space-y-1 border-t border-[#DBEAFE]/40 dark:border-white/5">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
              <span className="mt-0.5 text-[#2563EB]/70 dark:text-[#60A5FA]/70 flex-shrink-0">
                <ToolIcon tool={s.tool} />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[#0f172a]/70 dark:text-white/55">{s.label}</span>
                {s.summary && (
                  <span className={`ml-1 ${s.ok === false ? 'text-red-500 dark:text-red-400' : 'text-[#0f172a]/45 dark:text-white/35'}`}>
                    → {s.summary}
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
      {/* 교체 제안: diff 미리보기 — 제거할 장소를 빨간 취소선으로 표시 */}
      {isReplace && action.remove_names && action.remove_names.length > 0 && (
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] text-[#0f172a]/40 dark:text-white/30 mb-1.5">
            기존 장소 {action.remove_names.length}곳을 제거합니다
          </p>
          <div className="space-y-1 mb-2">
            {action.remove_names.map((name, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20"
              >
                <X size={11} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                <span className="text-red-600 dark:text-red-400 line-through truncate">{name}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#2563EB] dark:text-[#60A5FA] font-medium mb-1">
            <ArrowLeftRight size={10} />
            <span>아래 장소로 교체</span>
          </div>
        </div>
      )}
      {/* 장소 목록 — 체크박스로 개별 선택/제외 */}
      <div className="px-3 pt-3 pb-2 space-y-1.5">
        <p className="text-[10px] text-[#0f172a]/40 dark:text-white/30 mb-1">
          {isReplace ? `추가할 장소 선택 (${selectedPlaces.size}/${action.places.length})` : `추가할 장소를 선택하세요 (${selectedPlaces.size}/${action.places.length})`}
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
            <div className="flex gap-1.5">
              <button
                onClick={() => void handleAdd()}
                disabled={adding || !selectedDate || selectedPlaces.size === 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {adding ? '추가 중...' : `선택 장소 ${selectedPlaces.size}개 추가하기`}
              </button>
              {/* 추가 진행 중 취소 버튼 */}
              {adding && (
                <button
                  onClick={handleCancelAdd}
                  className="flex items-center justify-center px-2.5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all active:scale-95 cursor-pointer"
                  aria-label="추가 취소"
                >
                  <X size={12} />
                </button>
              )}
            </div>
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
  // 히스토리 접기 — true면 초기 메시지(index 0)를 제외한 이전 대화를 숨김
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  // 패널 높이 — 드래그로 조절 (px)
  const [panelHeight, setPanelHeight] = useState(520);
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef(520);
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

  // 드래그로 패널 높이 조절 — mousedown에서 시작, window mousemove/mouseup으로 추적
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    dragStartY.current = e.clientY;
    dragStartH.current = panelHeight;
    const onMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = dragStartY.current - ev.clientY; // 위로 드래그 → 높이 증가
      const next = Math.min(700, Math.max(320, dragStartH.current + delta));
      setPanelHeight(next);
    };
    const onUp = () => {
      dragStartY.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelHeight]);

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

  return (
    <>
      {/* 채팅 패널 */}
      {open && (
        <div
          className="absolute right-4 z-30 w-[320px] flex flex-col rounded-3xl shadow-2xl bg-white dark:bg-[#1c1c1e] border border-[#DBEAFE]/60 dark:border-white/8 overflow-hidden"
          style={{
            bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
            height: `min(${panelHeight}px, calc(85vh - env(safe-area-inset-bottom, 0px)))`,
            boxShadow: '0 8px 40px rgba(37,99,235,0.15), 0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          {/* 드래그 핸들 — 패널 상단 중앙, 위/아래로 드래그해 높이 조절 */}
          <div
            className="flex justify-center pt-2 pb-0 cursor-ns-resize select-none flex-shrink-0"
            onMouseDown={handleDragStart}
          >
            <div className="w-8 h-1 rounded-full bg-[#DBEAFE] dark:bg-white/20" />
          </div>
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
              {/* 이전 대화 보기/접기 — 메시지가 3개 이상일 때만 표시 */}
              {messages.length >= 3 && (
                <button
                  onClick={() => setHistoryCollapsed((v) => !v)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label={historyCollapsed ? '이전 대화 보기' : '이전 대화 접기'}
                  title={historyCollapsed ? '이전 대화 보기' : '이전 대화 접기'}
                >
                  <History size={13} className="text-white" />
                </button>
              )}
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
            {/* 히스토리 접기 배너 — 이전 대화가 숨겨진 상태 */}
            {historyCollapsed && messages.length >= 3 && (
              <button
                onClick={() => setHistoryCollapsed(false)}
                className="w-full text-center text-[11px] text-[#2563EB] dark:text-[#60A5FA] py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-[#2563EB]/10 border border-[#DBEAFE] dark:border-[#2563EB]/20 hover:bg-[#DBEAFE]/50 transition-colors cursor-pointer"
              >
                이전 대화 {messages.length - 2}개 보기 ↑
              </button>
            )}

            {messages.map((msg, i) => {
              // 히스토리 접기 상태: 첫 메시지(index 0)와 마지막 2개만 표시
              if (historyCollapsed && messages.length >= 3 && i > 0 && i < messages.length - 2) return null;
              return (
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

                <div className={`flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[82%]`}>
                  {/* Agent thinking box — AI 답변 위에 표시 */}
                  {msg.role === 'ai' && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                    <div className="mb-1 w-full">
                      <ThinkingBox
                        steps={msg.thinkingSteps}
                        ms={msg.thinkingMs}
                        loading={loading && i === messages.length - 1 && !msg.text}
                      />
                    </div>
                  )}

                  {msg.role === 'user' ? (
                    <div className="px-3 py-2.5 rounded-2xl rounded-br-sm bg-[#2563EB] text-white text-sm leading-relaxed">
                      {msg.text}
                    </div>
                  ) : msg.isError ? (
                    <div className="max-w-[88%] px-3 py-2.5 rounded-2xl rounded-tl-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm leading-relaxed">
                      {msg.text}
                    </div>
                  ) : msg.text ? (
                    <AiBubble text={msg.text} />
                  ) : null}

                  {/* 타임스탬프 */}
                  {msg.timestamp && (
                    <span className="text-[9px] text-[#0f172a]/25 dark:text-white/20 px-1 leading-none">
                      {msg.timestamp}
                    </span>
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
              );
            })}

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
                        // dayPlans가 없으면 AI가 action을 줄 수 없음 — 스타일 저장 안내만
                        if (dayPlans.length === 0) {
                          setMessages((prev) => [
                            ...prev,
                            { role: 'user', text: `${chip.emoji} ${chip.label} 스타일로 여행할 거야. 추천해줘!` },
                            { role: 'ai', text: `**${chip.label}** 스타일로 설정했어요! ✨\n여행 날짜를 먼저 설정하면 해당 스타일에 맞는 장소를 바로 추천해드릴게요.` },
                          ]);
                        } else {
                          void sendMessage(`${chip.emoji} ${chip.label} 스타일로 여행할 거야. 추천해줘!`);
                        }
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
          <div className="px-3 py-3 bg-white dark:bg-[#2c2c2e] border-t border-[#DBEAFE]/40 dark:border-white/8 flex-shrink-0">
            <div className="flex items-end gap-2 px-3 py-2 rounded-2xl bg-[#F0F4FF] dark:bg-[#252527] border border-[#DBEAFE]/60 dark:border-white/8 transition-all focus-within:border-[#2563EB]/40 dark:focus-within:border-[#3B82F6]/40 focus-within:ring-2 focus-within:ring-[#2563EB]/10">
              {/* textarea — Shift+Enter 줄바꿈, Enter 전송, 최대 4줄 자동 늘어남 */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // 높이 자동 조절 — 스크롤 없이 최대 4줄까지
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={loading ? '응답 기다리는 중...' : '메시지를 입력하세요... (Shift+Enter 줄바꿈)'}
                maxLength={500}
                disabled={loading}
                rows={1}
                className="flex-1 text-sm bg-transparent outline-none text-[#0f172a] dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25 disabled:cursor-not-allowed resize-none leading-relaxed overflow-hidden"
                style={{ minHeight: '22px', maxHeight: '96px' }}
              />
              <button
                onClick={loading ? handleCancel : () => void handleSend()}
                disabled={!loading && !input.trim()}
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer flex-shrink-0 mb-0.5 ${
                  loading
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#2563EB] disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:cursor-not-allowed'
                }`}
                aria-label={loading ? '응답 취소' : '메시지 전송'}
              >
                {loading ? <X size={12} className="text-white" /> : <Send size={12} className="text-white" />}
              </button>
            </div>
            <p className="text-[9px] text-[#0f172a]/20 dark:text-white/15 text-right mt-1 pr-1">Shift+Enter 줄바꿈</p>
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
