'use client';
import { useState, useRef } from 'react';
import { X, Plus, Loader2, ArrowLeftRight } from 'lucide-react';
import { nestApi } from '@/config/api.config';
import usePlanStore, { GooglePlace } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import { ChatAction, CATEGORY_EMOJI, getActionPlaceName, getActionPlaceCategory } from './types';

export default function ActionCard({ action, city, onDone }: { action: ChatAction; city: string; onDone: () => void }) {
  const [selectedDate, setSelectedDate] = useState(action.target_date ?? '');
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [sortFailed, setSortFailed] = useState(false);
  const [lastAddedPlaces, setLastAddedPlaces] = useState<{ places: GooglePlace[]; date: string } | null>(null);
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

    if (isReplace && action.remove_names) {
      const removeSet = new Set(action.remove_names.map((n) => n.toLowerCase().trim()));
      const toRemove = currentPlaces.filter(
        (p) => !p.slotType && removeSet.has(p.name.toLowerCase().trim()),
      );
      for (const p of toRemove) {
        removePlaceFromDayPlan(selectedDate, p.place_id);
      }
      currentPlaces = currentPlaces.filter((p) => !toRemove.includes(p));
    }

    const existingIds = new Set(currentPlaces.map((p) => p.place_id));
    const addedPlaces: GooglePlace[] = [];
    const placesToAdd = action.places.filter((_, i) => selectedPlaces.has(i));

    const results = await Promise.allSettled(
      placesToAdd.map((place) => {
        const name = getActionPlaceName(place);
        const category = getActionPlaceCategory(place);
        return nestApi.post<GooglePlace | null>('/place-search/resolve', { name, city, category }, { signal: controller.signal })
          .then((res) => ({ res, category }));
      })
    );

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
