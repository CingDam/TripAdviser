'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Plus, Loader2, ArrowLeftRight, MapPin, RefreshCw } from 'lucide-react';
import { nestApi } from '@/config/api.config';
import usePlanStore, { GooglePlace, TransitMode } from '@/store/usePlanStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import { ChatAction, ChatActionPlace, CATEGORY_EMOJI, getActionPlaceName, getActionPlaceCategory } from './types';

export default function ActionCard({ action, city, onDone }: { action: ChatAction; city: string; onDone: () => void }) {
  const [selectedDate, setSelectedDate] = useState(action.target_date ?? '');
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [sortFailed, setSortFailed] = useState(false);
  const [lastAddedPlaces, setLastAddedPlaces] = useState<{ places: GooglePlace[]; date: string } | null>(null);
  // action.places를 로컬로 승격 — '다른 곳' 인라인 교체가 특정 인덱스만 새 장소로 바꾼다
  const [places, setPlaces] = useState<(ChatActionPlace | string)[]>(action.places);
  const [swappingIdx, setSwappingIdx] = useState<number | null>(null);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<number>>(
    () => new Set(action.places.map((_, i) => i))
  );
  const addAbortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewShown, setPreviewShown] = useState(false);
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const addPlaceToDayPlan = usePlanStore((s) => s.addPlaceToDayPlan);
  const removePlaceFromDayPlan = usePlanStore((s) => s.removePlaceFromDayPlan);
  const reorderDayPlan = usePlanStore((s) => s.reorderDayPlan);
  const setPreviewPlaces = usePlanStore((s) => s.setPreviewPlaces);
  const { show } = useSnackbar();

  // 카드가 사라질 때(적용·취소·언마운트) 지도 미리보기 핀 정리 — 잔존 핀 방지
  useEffect(() => {
    return () => {
      previewAbortRef.current?.abort();
      setPreviewPlaces([]);
    };
  }, [setPreviewPlaces]);

  const availableDates = dayPlans.map((d) => d.date);
  const isReplace = !!(action.remove_names && action.remove_names.length > 0);
  // 삭제 전용 — 제거할 장소만 있고 추가 장소가 없는 제안 (잘못 삽입된 장소 빼기)
  const isRemoveOnly = isReplace && action.places.length === 0;

  function togglePlace(idx: number) {
    // 선택이 바뀌면 기존 미리보기는 stale — 닫아서 다시 '지도에서 보기'를 누르게 한다
    if (previewShown) {
      setPreviewPlaces([]);
      setPreviewShown(false);
    }
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

  // '지도에서 보기' — 선택된 추천 장소를 resolve해 좌표를 얻고 지도에 임시 핀으로 표시
  // [적용] 전 미리 위치를 확인시켜주는 용도라 좌표만 쓰고 일정엔 넣지 않는다
  async function handlePreviewOnMap() {
    if (previewShown) {
      setPreviewPlaces([]);
      setPreviewShown(false);
      return;
    }
    const placesToPreview = places.filter((_, i) => selectedPlaces.has(i));
    if (placesToPreview.length === 0) return;
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setPreviewing(true);
    const resolveCity = action.city || city;
    const results = await Promise.allSettled(
      placesToPreview.map((place) =>
        nestApi.post<GooglePlace | null>(
          '/place-search/resolve',
          { name: getActionPlaceName(place), city: resolveCity, category: getActionPlaceCategory(place) },
          { signal: controller.signal },
        ).then((res) => res.data)
      )
    );
    if (controller.signal.aborted) return;
    const resolved = results
      .filter((r): r is PromiseFulfilledResult<GooglePlace> => r.status === 'fulfilled' && !!r.value)
      .map((r) => r.value);
    setPreviewing(false);
    if (resolved.length === 0) {
      show('장소 위치를 가져오지 못했어요.', 'error');
      return;
    }
    setPreviewPlaces(resolved);
    setPreviewShown(true);
    if (resolved.length < placesToPreview.length) {
      show(`${placesToPreview.length - resolved.length}곳은 위치를 못 찾았어요.`, 'warning');
    }
  }

  // '다른 곳' — 해당 장소를 같은 카테고리·같은 지역의 다른 실재 장소로 그 자리만 교체
  // resolve로 기준 좌표를 얻고 nearby(반경 2km)에서 현재 목록에 없는 첫 후보를 고른다
  async function handleSwapPlace(idx: number) {
    const target = places[idx];
    const category = getActionPlaceCategory(target) ?? '관광지';
    setSwappingIdx(idx);
    try {
      const resolveCity = action.city || city;
      const resolveRes = await nestApi.post<GooglePlace | null>(
        '/place-search/resolve',
        { name: getActionPlaceName(target), city: resolveCity, category },
      );
      const anchor = resolveRes.data?.location;
      if (!anchor) {
        show('이 장소의 위치를 못 찾아 교체할 수 없어요.', 'error');
        return;
      }
      const nearbyRes = await nestApi.post<{ place_id: string; name: string }[]>(
        '/place-search/nearby',
        { lat: anchor.lat, lng: anchor.lng, category, radius: 2000 },
      );
      // 현재 카드에 이미 있는 이름·일정에 있는 이름은 제외 — 중복 추천 방지
      const usedNames = new Set(
        [...places.map((p) => getActionPlaceName(p)), ...(dayPlans.flatMap((d) => d.places.map((p) => p.name)))]
          .map((n) => n.toLowerCase().trim())
      );
      const candidate = nearbyRes.data.find((c) => !usedNames.has(c.name.toLowerCase().trim()));
      if (!candidate) {
        show('근처에 바꿀 만한 다른 곳을 못 찾았어요.', 'warning');
        return;
      }
      setPlaces((prev) => prev.map((p, i) => (i === idx ? { name: candidate.name, category } : p)));
      // 교체된 항목은 자동 선택 + 미리보기 stale 처리
      setSelectedPlaces((prev) => new Set(prev).add(idx));
      if (previewShown) {
        setPreviewPlaces([]);
        setPreviewShown(false);
      }
    } catch {
      show('교체 중 문제가 생겼어요. 다시 시도해 주세요.', 'error');
    } finally {
      setSwappingIdx(null);
    }
  }

  async function handleAdd() {
    // 삭제 전용은 추가 장소 선택이 없어도 진행 — 제거할 날짜만 정해지면 된다
    if (!selectedDate || (!isRemoveOnly && selectedPlaces.size === 0)) return;
    const controller = new AbortController();
    addAbortRef.current = controller;
    setAdding(true);
    let added = 0;
    let failed = 0;
    let removed = 0;
    const selectedDay = dayPlans.find((d) => d.date === selectedDate);
    let currentPlaces = selectedDay?.places ?? [];

    if (isReplace && action.remove_names) {
      const removeSet = new Set(action.remove_names.map((n) => n.toLowerCase().trim()));
      // 정확 일치 우선, 없으면 부분 포함 매칭 — AI가 truncate된/약식 이름을 줄 수 있어 보강
      const toRemove = currentPlaces.filter((p) => {
        if (p.slotType) return false;
        const nameLower = p.name.toLowerCase().trim();
        if (removeSet.has(nameLower)) return true;
        return action.remove_names!.some((rn) => {
          const r = rn.toLowerCase().trim();
          return r.length >= 2 && (nameLower.includes(r) || r.includes(nameLower));
        });
      });
      for (const p of toRemove) {
        removePlaceFromDayPlan(selectedDate, p.place_id);
      }
      removed = toRemove.length;
      currentPlaces = currentPlaces.filter((p) => !toRemove.includes(p));
    }

    const existingIds = new Set(currentPlaces.map((p) => p.place_id));
    const addedPlaces: GooglePlace[] = [];
    const placesToAdd = places.filter((_, i) => selectedPlaces.has(i));

    // action.city: Agent가 conversation_city로 찾은 경우 props.city와 다를 수 있음 — 제안 도시 우선 사용
    const resolveCity = action.city || city;
    const results = await Promise.allSettled(
      placesToAdd.map((place) => {
        const name = getActionPlaceName(place);
        const category = getActionPlaceCategory(place);
        return nestApi.post<GooglePlace | null>('/place-search/resolve', { name, city: resolveCity, category }, { signal: controller.signal })
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
          const response = await nestApi.post<{ places: { place: GooglePlace; time_slot: string; transit_mode?: TransitMode | null }[] }>(
            '/ai/sort',
            { places: normalPlaces, date: selectedDate },
          );
          const sortedNormal = response.data.places.map((item) => ({ ...item.place, timeSlot: item.time_slot, transitMode: item.transit_mode }));
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
              // 마지막날 귀국: 현지 출국(arrive) → 집 도착(depart) 순서로 뒤에 배치
              beforeSlots = currentPlaces.filter((p) => p.slotType === 'hotel');
              const arrive = currentPlaces.filter((p) => p.slotType === 'airport_arrive');
              const depart = currentPlaces.filter((p) => p.slotType === 'airport_depart');
              afterSlots = [...arrive, ...depart];
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
    // 삭제 전용 — 추가 없이 제거만 수행한 경우 별도 피드백
    if (isRemoveOnly) {
      if (removed > 0) {
        show(`${removed}개 장소를 일정에서 삭제했어요.`, 'success');
        setDone(true);
        onDone();
      } else {
        show('삭제할 장소를 찾지 못했어요.', 'error');
      }
      return;
    }
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
      const response = await nestApi.post<{ places: { place: GooglePlace; time_slot: string; transit_mode?: TransitMode | null }[] }>(
        '/ai/sort',
        { places: lastAddedPlaces.places, date: lastAddedPlaces.date },
      );
      const sorted = response.data.places.map((item) => ({ ...item.place, timeSlot: item.time_slot, transitMode: item.transit_mode }));
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
          {!isRemoveOnly && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#2563EB] dark:text-[#60A5FA] font-medium mb-1">
              <ArrowLeftRight size={11} strokeWidth={2} />
              <span>아래 장소로 교체</span>
            </div>
          )}
        </div>
      )}

      {!isRemoveOnly && (
      <div className="px-3.5 pt-3 pb-2 space-y-1.5">
        <p className="text-[11px] text-[#0f172a]/50 dark:text-zinc-500 mb-1 font-medium">
          추가할 장소 ({selectedPlaces.size}/{places.length})
        </p>
        {places.map((place, i) => {
          const name = getActionPlaceName(place);
          const category = getActionPlaceCategory(place);
          const emoji = category ? (CATEGORY_EMOJI[category] ?? '📍') : '📍';
          const isSelected = selectedPlaces.has(i);
          const isSwapping = swappingIdx === i;
          return (
            <div
              key={i}
              className={`w-full flex items-center gap-1 text-[13px] pl-3 pr-2 py-2 rounded-lg transition-all ${
                isSelected
                  ? 'bg-[#EFF6FF]/60 dark:bg-white/[0.04] border border-[#DBEAFE] dark:border-white/[0.1]'
                  : 'bg-transparent border border-transparent opacity-50 hover:opacity-75'
              }`}
            >
              <button
                onClick={() => togglePlace(i)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
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
              </button>
              {category && (
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-white/[0.06] text-[#2563EB] dark:text-[#60A5FA] font-medium">
                  {category}
                </span>
              )}
              <button
                onClick={() => void handleSwapPlace(i)}
                disabled={isSwapping || adding}
                title="다른 곳으로 바꾸기"
                aria-label="다른 곳으로 바꾸기"
                className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[#0f172a]/35 dark:text-zinc-500 hover:text-[#2563EB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isSwapping ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} strokeWidth={2} />}
              </button>
            </div>
          );
        })}
      </div>
      )}

      <div className="px-3.5 pb-3 pt-1 space-y-2.5">
        {availableDates.length > 0 ? (
          <>
            <p className="text-[11px] text-[#0f172a]/50 dark:text-zinc-500 font-medium">
              {isRemoveOnly ? '어느 날에서 삭제할까요?' : '어느 날 추가할까요?'}
            </p>
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
            {!isRemoveOnly && selectedPlaces.size > 0 && (
              <button
                onClick={() => void handlePreviewOnMap()}
                disabled={previewing}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#DBEAFE] dark:border-white/[0.1] bg-white dark:bg-transparent text-[12px] font-medium text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer tracking-tight"
              >
                {previewing ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} strokeWidth={2.2} />}
                {previewing ? '위치 확인 중' : previewShown ? '미리보기 끄기' : '지도에서 보기'}
              </button>
            )}
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={() => void handleAdd()}
                disabled={adding || !selectedDate || (!isRemoveOnly && selectedPlaces.size === 0)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-white text-[13px] font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed tracking-tight disabled:text-white/50 ${
                  isRemoveOnly
                    ? 'bg-red-500 dark:bg-red-500/80 hover:bg-red-600 dark:hover:bg-red-500 disabled:bg-red-200 dark:disabled:bg-red-500/20'
                    : 'bg-[#2563EB] dark:bg-[#3B82F6] hover:bg-[#1D4ED8] dark:hover:bg-[#60A5FA] disabled:bg-[#DBEAFE] dark:disabled:bg-white/[0.06] disabled:text-[#2563EB]/40 dark:disabled:text-zinc-600'
                }`}
              >
                {adding ? <Loader2 size={13} className="animate-spin" /> : isRemoveOnly ? <X size={13} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={2.5} />}
                {adding ? (isRemoveOnly ? '삭제 중' : '추가 중') : isRemoveOnly ? '삭제하기' : `${selectedPlaces.size}개 추가`}
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
