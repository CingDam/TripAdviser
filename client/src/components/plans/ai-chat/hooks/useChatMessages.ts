'use client';
import { useState, useRef, useEffect } from 'react';
import { nestApi } from '@/config/api.config';
import usePlanStore, { GooglePlace, DayPlan } from '@/store/usePlanStore';
import { Message, ThinkingStep, ChatAction, SESSION_KEY, nowHHMM } from '../types';
import { detectCityInText, detectNearbyCategory, detectFullGenerate, detectMultiCityPlan } from '../utils/detect';
import { buildFollowUpChips } from '../utils/chips';

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

async function runFullGenerate(
  city: string,
  dayPlans: DayPlan[],
  travelStyle: string | null,
  dayCities: Record<string, string>,
  addPlaceToDayPlan: (date: string, place: GooglePlace) => void,
  reorderDayPlan: (date: string, places: GooglePlace[]) => void,
): Promise<{ totalAdded: number; totalFailed: number }> {
  const dates = dayPlans.map((d) => d.date);
  const res = await nestApi.post<{
    city: string;
    day_plans: { date: string; city?: string; places: { name: string; category: string; reason: string }[] }[];
  }>('/ai/generate', {
    city,
    dates,
    day_cities: dayCities,
    ...(travelStyle ? { style: travelStyle } : {}),
  });

  let totalAdded = 0;
  let totalFailed = 0;

  for (const dp of res.data.day_plans) {
    // skip day — AI가 places를 빈 배열로 반환 → 이동/귀국일이므로 그냥 건너뜀
    if (!dp.places || dp.places.length === 0) continue;
    const existing = dayPlans.find((d) => d.date === dp.date);
    const hasNormal = existing?.places.some((p) => !p.slotType) ?? false;
    if (hasNormal) continue;

    // dp.city: AI가 날짜별로 반환하는 도시명. 빈 문자열이면 dayCities 매핑 → 기본 city 순으로 fallback
    const resolveCity = dp.city || dayCities[dp.date] || city;
    const resolvedPlaces: GooglePlace[] = [];

    for (const place of dp.places) {
      try {
        const resolved = await nestApi.post<GooglePlace | null>(
          '/place-search/resolve',
          { name: place.name, city: resolveCity, category: place.category },
        );
        if (resolved.data) {
          const gp = { ...resolved.data, rating: null, category: place.category };
          addPlaceToDayPlan(dp.date, gp);
          resolvedPlaces.push(gp);
          totalAdded++;
        } else {
          totalFailed++;
        }
      } catch {
        totalFailed++;
      }
    }

    if (resolvedPlaces.length >= 2) {
      try {
        const sortRes = await nestApi.post<{ places: { place: GooglePlace; time_slot: string }[] }>(
          '/ai/sort',
          { places: resolvedPlaces, date: dp.date },
        );
        const slotPlaces = sortRes.data.places.map((item) => ({ ...item.place, timeSlot: item.time_slot }));
        const existingPlaces = existing?.places ?? [];
        const firstNormalIdx = existingPlaces.findIndex((p) => !p.slotType);
        const lastNormalIdx = existingPlaces.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
        let beforeSlots: typeof existingPlaces;
        let afterSlots: typeof existingPlaces;
        if (firstNormalIdx === -1) {
          const dayIndex = dayPlans.findIndex((d) => d.date === dp.date);
          const isFirst = dayIndex === 0;
          const isLast = dayIndex === dayPlans.length - 1;
          if (isFirst) {
            beforeSlots = existingPlaces.filter((p) => p.slotType === 'airport_depart' || p.slotType === 'airport_arrive');
            afterSlots = existingPlaces.filter((p) => p.slotType === 'hotel');
          } else if (isLast) {
            beforeSlots = existingPlaces.filter((p) => p.slotType === 'hotel');
            afterSlots = existingPlaces.filter((p) => p.slotType === 'airport_arrive');
          } else {
            const hotelSlots = existingPlaces.filter((p) => p.slotType === 'hotel');
            beforeSlots = hotelSlots.slice(0, 1);
            afterSlots = hotelSlots.slice(1);
          }
        } else {
          beforeSlots = existingPlaces.slice(0, firstNormalIdx);
          afterSlots = lastNormalIdx === -1 ? [] : existingPlaces.slice(lastNormalIdx + 1);
        }
        reorderDayPlan(dp.date, [...beforeSlots, ...slotPlaces, ...afterSlots]);
      } catch {
        // 정렬 실패는 이미 추가된 장소 유지
      }
    }
  }

  return { totalAdded, totalFailed };
}

export function useChatMessages(city: string, cityKeywords: string[]) {
  const dayPlans = usePlanStore((s) => s.dayPlans);
  const addPlaceToDayPlan = usePlanStore((s) => s.addPlaceToDayPlan);
  const reorderDayPlan = usePlanStore((s) => s.reorderDayPlan);
  const dayCities = usePlanStore((s) => s.dayCities);
  const setDayCities = usePlanStore((s) => s.setDayCities);
  // 지도 현재 위치 — 일정에 장소가 없어도 nearby 검색 가능하도록 fallback용
  const currentLatLng = usePlanStore((s) => s.currentLatLng);

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
    const initial: Message = {
      role: 'ai',
      text: city
        ? `안녕하세요! **${city}** 여행을 준비하고 계시는군요 😊\n맛집, 관광지, 교통 팁 — 뭐든 물어보세요. 제가 직접 가본 곳도 있거든요!`
        : '안녕하세요! 여행지를 먼저 선택해주세요.\n도시가 정해지면 맞춤 일정과 꿀팁을 바로 드릴 수 있어요!',
      timestamp: nowHHMM(),
    };
    return { initialMessages: [initial], initialStyle: null };
  });

  const [travelStyle, setTravelStyle] = useState<string | null>(initialStyle);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ city, messages, style: travelStyle }));
    } catch { /* 용량 초과 무시 */ }
  }, [city, messages, travelStyle]);

  function reset() {
    const initial: Message = {
      role: 'ai',
      text: city
        ? `안녕하세요! **${city}** 여행을 준비하고 계시는군요 😊\n맛집, 관광지, 교통 팁 — 뭐든 물어보세요!`
        : '안녕하세요! 여행지를 먼저 선택해주세요.\n도시가 정해지면 맞춤 일정과 꿀팁을 바로 드릴 수 있어요!',
      timestamp: nowHHMM(),
    };
    setMessages([initial]);
    setTravelStyle(null);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ city, messages: [initial], style: null }));
    } catch { /* 무시 */ }
  }

  function cancel() {
    abortRef.current?.abort();
    setLoading(false);
    abortRef.current = null;
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const detectedCity = detectCityInText(trimmed, cityKeywords);
    const userMsg: Message = {
      role: 'user',
      text: trimmed,
      timestamp: nowHHMM(),
      ...(detectedCity ? { context: { city: detectedCity } } : {}),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    streamingTextRef.current = '';

    // 날짜별 도시 계획 설명 감지 — "첫날 오사카, 둘째날 교토" 패턴 → dayCities 업데이트 후 자동생성
    // skip day("_skip")는 자동생성 카운트에 포함하지 않음 — 실제 도시 2개 이상일 때만 분기
    const dates = dayPlans.map((d) => d.date);
    const detectedDayCities = detectMultiCityPlan(trimmed, dates, cityKeywords);
    const realCityCount = Object.values(detectedDayCities).filter((v) => v !== '_skip').length;
    const hasMultiCityPlan = realCityCount >= 2 || (realCityCount >= 1 && Object.values(detectedDayCities).some((v) => v === '_skip'));
    if (hasMultiCityPlan) {
      const merged = { ...dayCities, ...detectedDayCities };
      setDayCities(merged);
      const cityLines = Object.entries(detectedDayCities)
        .map(([d, c]) => c === '_skip' ? `• ${d}: **이동/귀국일 (장소 생성 안 함)**` : `• ${d}: **${c}**`)
        .join('\n');
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: `날짜별 도시를 파악했어요!\n${cityLines}\n\n일정을 자동으로 생성할게요...`,
          timestamp: nowHHMM(),
        },
      ]);
      try {
        // 사용자 원문을 style로 주입 — AI가 "다양한 곳 체험", "쇼핑" 등 키워드로 장소 수·카테고리 비중 결정
        const styleHint = travelStyle ? `${travelStyle} / ${trimmed}` : trimmed;
        const { totalAdded, totalFailed } = await runFullGenerate(city, dayPlans, styleHint, merged, addPlaceToDayPlan, reorderDayPlan);
        const resultText = totalAdded === 0
          ? '장소 정보를 가져오지 못했어요. 다시 시도해 주세요.'
          : totalFailed > 0
            ? `${totalAdded}개 장소를 일정에 추가했어요. (${totalFailed}개는 찾을 수 없어 건너뛰었어요)`
            : `${totalAdded}개 장소를 날짜·도시별로 배치하고 동선까지 정렬했어요. 일정 패널에서 확인해보세요!`;
        setMessages((prev) =>
          prev.map((m, idx) => idx === prev.length - 1 ? { ...m, text: resultText } : m)
        );
      } catch {
        setMessages((prev) =>
          prev.map((m, idx) =>
            idx === prev.length - 1
              ? { ...m, text: '일정 자동생성에 실패했어요. 잠시 후 다시 시도해 주세요.', isError: true }
              : m
          )
        );
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
      return;
    }

    // 전체 일정 생성 요청이면 /ai/generate로 분기
    if (detectFullGenerate(trimmed) && dayPlans.length === 0) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: '날짜를 먼저 설정해주세요. 여행 날짜가 있어야 전체 일정을 생성할 수 있어요.', timestamp: nowHHMM() },
      ]);
      setLoading(false);
      return;
    }
    if (detectFullGenerate(trimmed) && dayPlans.length > 0) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: `**${city}** ${dayPlans.length}일 전체 일정을 생성하고 있어요.\n장소를 조회하고 동선을 정리하는 중입니다...`, timestamp: nowHHMM() },
      ]);
      try {
        const { totalAdded, totalFailed } = await runFullGenerate(city, dayPlans, travelStyle, dayCities, addPlaceToDayPlan, reorderDayPlan);
        const resultText = totalAdded === 0
          ? '장소 정보를 가져오지 못했어요. 다시 시도해 주세요.'
          : totalFailed > 0
            ? `${totalAdded}개 장소를 일정에 추가했어요. (${totalFailed}개는 찾을 수 없어 건너뛰었어요)`
            : `${totalAdded}개 장소를 날짜별로 배치하고 동선까지 정렬했어요. 일정 패널에서 확인해보세요!`;
        setMessages((prev) =>
          prev.map((m, idx) => idx === prev.length - 1 ? { ...m, text: resultText } : m)
        );
      } catch {
        setMessages((prev) =>
          prev.map((m, idx) =>
            idx === prev.length - 1
              ? { ...m, text: '일정 자동생성에 실패했어요. 잠시 후 다시 시도해 주세요.', isError: true }
              : m
          )
        );
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const dayPlansPayload = dayPlans.map((dp) => ({
      date: dp.date,
      places: dp.places.filter((p) => !p.slotType).map((p) => ({
        name: p.name,
        lat: p.location?.lat,
        lng: p.location?.lng,
      })),
    }));

    const historyPayload = [...messages.slice(1), userMsg].slice(-20).map((m) => ({
      role: m.role,
      text: m.text,
      ...(m.context?.city ? { context: { city: m.context.city } } : {}),
    }));

    const messageWithStyle = travelStyle ? `[여행 스타일: ${travelStyle}] ${trimmed}` : trimmed;

    const nearbyCategory = detectNearbyCategory(trimmed);
    let nearbyPlaces: { name: string; formatted_address: string; rating?: number; user_ratings_total?: number; price_level?: number }[] = [];
    if (nearbyCategory) {
      // 일정 장소 중심 → 지도 현재 위치 순으로 fallback — 장소가 없어도 도시 중심 기준 nearby 검색
      const center = calcCenterCoord(dayPlans) ?? currentLatLng;
      if (center) {
        try {
          const nearbyRes = await nestApi.post<{ place_id: string; name: string; formatted_address: string; rating?: number; user_ratings_total?: number; price_level?: number }[]>(
            '/place-search/nearby',
            { lat: center.lat, lng: center.lng, category: nearbyCategory },
          );
          nearbyPlaces = (nearbyRes.data ?? []).map(({ name, formatted_address, rating, user_ratings_total, price_level }) => ({
            name, formatted_address, rating, user_ratings_total, price_level,
          }));
        } catch { /* nearby 실패 시 AI 학습 데이터로 fallback */ }
      }
    }

    const nestUrl = process.env.NEXT_PUBLIC_NEST_URL ?? 'http://localhost:3001';
    const center = calcCenterCoord(dayPlans) ?? currentLatLng;
    const thinkingStepsRef: ThinkingStep[] = [];
    const thinkingStartedAt = Date.now();

    try {
      const res = await fetch(`${nestUrl}/api/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
              follow_ups?: string[];
            };

            if (event.type === 'thinking' && event.tool && event.label) {
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
              const last = thinkingStepsRef[thinkingStepsRef.length - 1];
              if (last) { last.summary = event.summary; last.ok = event.ok; }
              setMessages((prev) =>
                prev.map((m, idx) => idx === prev.length - 1 ? { ...m, thinkingSteps: [...thinkingStepsRef] } : m)
              );
            } else if (event.type === 'token' && event.text) {
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
              const rawPlaces = event.action?.places ?? [];
              const actionPlaces = rawPlaces
                .filter((p) => typeof p === 'object' && p !== null)
                .map((p) => p as { name: string; category?: string | null });
              // AI가 follow_ups를 직접 반환하면 우선 사용, 없으면 클라이언트 규칙으로 생성
              const followUps = (event.follow_ups && event.follow_ups.length > 0)
                ? event.follow_ups
                : buildFollowUpChips(finalReply, !!event.action, actionPlaces);
              const ts = nowHHMM();
              const thinkingMs = thinkingStepsRef.length > 0 ? Date.now() - thinkingStartedAt : undefined;
              if (streamingStarted) {
                setMessages((prev) =>
                  prev.map((m, idx) =>
                    idx === prev.length - 1
                      ? { ...m, text: finalReply, action: event.action, followUps, timestamp: ts, thinkingMs }
                      : m
                  )
                );
              } else {
                streamingStarted = true;
                setMessages((prev) => [
                  ...prev,
                  { role: 'ai', text: finalReply, action: event.action, followUps, timestamp: ts, thinkingMs },
                ]);
              }
            } else if (event.type === 'error') {
              const errMsg: Message = { role: 'ai', text: event.message ?? '응답 중 오류가 발생했어요.', isError: true };
              if (streamingStarted) {
                setMessages((prev) => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, ...errMsg } : m));
              } else {
                streamingStarted = true;
                setMessages((prev) => [...prev, errMsg]);
              }
            }
          } catch { /* 잘못된 SSE 이벤트 무시 */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 취소 시 부분 텍스트에 취소 표시 추가
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'ai' && last.text && !last.isError) {
            return prev.map((m, idx) =>
              idx === prev.length - 1 ? { ...m, text: m.text + '\n*(응답이 취소되었어요)*', isError: true } : m
            );
          }
          return prev;
        });
      } else {
        setMessages((prev) => [...prev, {
          role: 'ai',
          text: '일시적으로 응답하지 못했어요. 잠시 후 다시 시도해 주세요.',
          isError: true,
        }]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      streamingTextRef.current = '';
    }
  }

  return { messages, setMessages, loading, travelStyle, setTravelStyle, sendMessage, reset, cancel };
}
