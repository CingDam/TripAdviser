'use client';
import { useState, useRef, useEffect } from 'react';
import { nestApi } from '@/config/api.config';
import usePlanStore, { GooglePlace, DayPlan, TransitMode } from '@/store/usePlanStore';
import { Message, ThinkingStep, ChatAction, GenerateAction, SESSION_KEY, nowHHMM, relativeDayLabel } from '../types';
import { detectCityInText, detectNearbyCategory } from '../utils/detect';
import { buildFollowUpChips } from '../utils/chips';

// 직선거리는 강·산 우회를 반영하지 못해 역 삽입 판단이 부정확하다 — 이중 임계값으로 구간을 나눈다
const WALK_CONFIRM_KM = 0.8; // 이 이하는 직선이 우회를 감안해도 도보권 → 역 불필요 (경로 조회 생략)
const TRANSIT_CONFIRM_KM = 2.5; // 이 이상은 직선이어도 사실상 탑승 구간 → 역 삽입 (경로 조회 생략)
const WALK_LIMIT_MIN = 15; // 회색지대(0.8~2.5km) 실제 도보시간이 이 값 초과면 역 삽입
const NEARBY_TRANSIT_RADIUS_M = 1000; // 도착지 반경 — 하차역 후보 조회용

// 동선 검증 — 자동생성 직후 같은 날 장소가 동선상 고립됐는지 판단
// 최근접 이웃(가장 가까운 같은 날 장소)까지 거리가 이 값 초과면 '고립'으로 본다.
// 중심점 거리 대신 최근접을 쓰는 이유 — 장소가 두 구역으로 갈리면 중심점은 빈 허공에 찍혀
// 모두가 '약간 멀어' 아무도 안 잡힌다. 최근접은 진짜 외딴 장소만 정확히 포착한다.
const OUTLIER_NN_KM = 3; // km — 도보·짧은 이동권 밖. 도시 규모마다 다르지만 보수적으로 잡아 오교체 방지
// 교체 후보 검색 반경 — 고립 아닌 나머지 장소들의 중심에서 이 반경 안을 찾는다
const REPLACE_SEARCH_RADIUS_M = 2000;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// 같은 날 장소들 중 동선상 고립된 장소들의 인덱스를 반환한다.
// 각 장소의 '최근접 이웃까지 거리'가 OUTLIER_NN_KM를 넘으면 고립으로 판정.
// 장소가 3곳 미만이면 비교 의미가 없어 빈 배열 반환.
function detectOutlierIndices(places: GooglePlace[]): number[] {
  if (places.length < 3) return [];
  const outliers: number[] = [];
  for (let i = 0; i < places.length; i++) {
    let nearest = Infinity;
    for (let j = 0; j < places.length; j++) {
      if (i === j) continue;
      const d = haversineKm(places[i].location, places[j].location);
      if (d < nearest) nearest = d;
    }
    if (nearest > OUTLIER_NN_KM) outliers.push(i);
  }
  return outliers;
}

// 좌표 목록의 평균 중심점 — 교체 후보를 찾을 기준 좌표
function centroid(places: GooglePlace[]): { lat: number; lng: number } {
  const sum = places.reduce(
    (acc, p) => ({ lat: acc.lat + p.location.lat, lng: acc.lng + p.location.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / places.length, lng: sum.lng / places.length };
}

// nearby 검색이 반환하는 장소 — searchNearby와 동일 구조(평점 포함, POPULARITY 정렬)
type NearbyResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  location: { lat: number; lng: number };
  types?: string[];
};

// 고립 장소를 같은 카테고리의 가까운 실재 장소로 교체한다.
// anchor(고립 아닌 나머지) 중심 반경에서 nearby 검색 → 이미 일정에 없는 첫 후보로 교체.
// 후보가 없으면 null — 호출부가 원본 유지. LLM 호출 없음(좌표 반경 검색이라 가까움·실재 모두 보장).
async function findNearbyReplacement(
  outlier: GooglePlace,
  anchors: GooglePlace[],
  existingIds: Set<string>,
): Promise<GooglePlace | null> {
  const category = outlier.category;
  // nearby가 매핑하는 카테고리가 아니면(교통·호텔 등) 교체 시도 안 함 — 동선 교정 대상 아님
  if (!category || !['식당', '카페', '관광지', '쇼핑', '자연', '문화'].includes(category)) return null;
  try {
    const center = centroid(anchors);
    const res = await nestApi.post<NearbyResult[]>('/place-search/nearby', {
      lat: center.lat,
      lng: center.lng,
      category,
      radius: REPLACE_SEARCH_RADIUS_M,
    });
    const candidates = res.data ?? [];
    // 이미 일정에 있는 장소·고립 장소 자신은 제외. nearby는 POPULARITY순이라 첫 유효 후보가 최적
    const chosen = candidates.find(
      (c) => c.place_id && !existingIds.has(c.place_id) && c.place_id !== outlier.place_id,
    );
    if (!chosen) return null;
    return {
      place_id: chosen.place_id,
      name: chosen.name,
      formatted_address: chosen.formatted_address,
      location: chosen.location,
      types: chosen.types ?? [],
      rating: null,
      category,
    };
  } catch {
    return null;
  }
}

// nearby-transit 후보 — searchNearbyTransit가 반환하는 실제 장소(좌표·place_id 포함)
type TransitCandidate = {
  place_id: string;
  name: string;
  formatted_address: string;
  location: { lat: number; lng: number };
  types?: string[];
};

// 지정 좌표 반경에서 역 후보를 조회하고 LLM이 동선상 최적 역을 고른다.
// 후보 자체가 이미 nearby로 정확한 좌표·place_id를 가지므로 그 객체를 그대로 사용한다.
// (선택된 이름을 다시 resolve하면 textQuery가 타국 동명 역을 잡을 수 있어 — 예: '나라'→수원 — 오삽입)
// 실패하면 null — 호출부가 역 없이 진행
async function findTransitStop(
  coord: { lat: number; lng: number },
  radius: number,
  fromName: string,
  toName: string,
): Promise<GooglePlace | null> {
  try {
    const candidatesRes = await nestApi.post<TransitCandidate[]>(
      '/place-search/nearby-transit',
      { lat: coord.lat, lng: coord.lng, radius },
    );
    const candidates = candidatesRes.data;
    if (!candidates || candidates.length === 0) return null;

    // Gemini가 후보 중 동선상 최적 역 선택
    const selectRes = await nestApi.post<{ name: string }>('/ai/select-transit', {
      from_place: fromName,
      to_place: toName,
      candidates: candidates.map((c) => ({ name: c.name, formatted_address: c.formatted_address })),
    });
    const selectedName = selectRes.data?.name;
    if (!selectedName) return null;

    // 선택된 이름에 해당하는 후보를 그대로 사용 — 좌표·place_id 보존. 매칭 실패 시 첫 후보
    const chosen = candidates.find((c) => c.name === selectedName) ?? candidates[0];
    return {
      place_id: chosen.place_id,
      name: chosen.name,
      formatted_address: chosen.formatted_address,
      location: chosen.location,
      types: chosen.types ?? [],
      rating: null,
      category: '교통',
    };
  } catch {
    return null;
  }
}

// 회색지대(0.8~2.5km)에서 실제 도보시간으로 역 삽입 여부 판단.
// 직선거리는 강·산 우회를 못 잡으므로 이 구간만 Routes로 확인 — 조회 실패 시 직선거리 폴백(삽입)
async function shouldInsertByWalk(a: GooglePlace, b: GooglePlace): Promise<boolean> {
  try {
    const res = await nestApi.post<{ minutes: number | null }>('/place-search/walk-distance', {
      fromLat: a.location.lat,
      fromLng: a.location.lng,
      toLat: b.location.lat,
      toLng: b.location.lng,
    });
    const minutes = res.data?.minutes;
    if (minutes == null) return true; // 경로 조회 실패 → 보수적으로 삽입
    return minutes > WALK_LIMIT_MIN;
  } catch {
    return true; // 폴백 — 직선거리가 회색지대라는 건 이미 확인됨
  }
}

// resolvePlace 완료 후, 각 목적지로 이동하는 구간마다 그 목적지 근처 하차역을 목적지 바로 앞에 삽입한다.
// (공항→하카타역→텐진, 텐진→오호리공원역→오호리공원 처럼 "내려서 걷는" 역을 목적지 코앞에 둔다)
// - ~0.8km: 도보권 → 생략
// - 0.8~2.5km: 회색지대 → 실제 도보시간 조회 후 15분 초과 시 삽입
// - 2.5km+: 탑승 구간 → 항상 삽입
// 도착지(category='교통')가 이미 역인 구간만 건너뜀 — 출발지가 역이어도 하차역은 따로 필요하다.
// 역이 드문 도시(후보 0개)는 findTransitStop이 null을 반환해 자연히 생략 → 전 세계 대응
async function insertTransitStops(places: GooglePlace[]): Promise<GooglePlace[]> {
  const result: GooglePlace[] = [];

  for (let i = 0; i < places.length; i++) {
    if (i === 0) {
      result.push(places[i]);
      continue;
    }

    const a = places[i - 1]; // 출발지
    const b = places[i]; // 도착지 — 하차역은 이쪽 근처

    // 도착지가 이미 역이면 그게 곧 하차점 → 별도 하차역 불필요.
    // 단, 출발지가 역이어도 건너뛰지 않는다 — 탑승역과 하차역은 다르므로
    // (교토역에서 타도 후시미이나리는 이나리역에서 내려 걸어야 함) 도착지 앞 하차역이 필요하다.
    if (b.category === '교통') {
      result.push(b);
      continue;
    }

    const dist = haversineKm(a.location, b.location);
    if (dist <= WALK_CONFIRM_KM) {
      result.push(b); // 도보 확정 — 역 불필요
      continue;
    }

    // 회색지대만 실제 도보시간 확인 — 그 외 구간은 거리로 바로 판단해 Routes 호출 절약
    if (dist <= TRANSIT_CONFIRM_KM && !(await shouldInsertByWalk(a, b))) {
      result.push(b);
      continue;
    }

    // 도착지 반경에서 하차역 1개 — 목적지 바로 앞에 삽입
    const stop = await findTransitStop(b.location, NEARBY_TRANSIT_RADIUS_M, a.name, b.name);
    if (stop) result.push(stop);
    result.push(b);
  }

  return result;
}

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
  hotelName?: string | null,
  onProgress?: (text: string, progress?: { current: number; total: number }) => void,
  mustVisit?: string[],
  regenerateDates?: string[],
  arrivalTime?: string | null,
  departureTime?: string | null,
): Promise<{ totalAdded: number; totalFailed: number }> {
  const dates = dayPlans.map((d) => d.date);
  // 재생성 대상 날짜 — 이미 장소가 있어도 비우고 다시 채운다 (그 외 채워진 날은 건너뜀)
  const regenSet = new Set(regenerateDates ?? []);
  onProgress?.(`**${city}** ${dayPlans.length}일 일정을 구상하고 있어요...`);
  const res = await nestApi.post<{
    city: string;
    // places[].city — 하루 안에서 도시가 바뀌는 날(교토 오후→오사카 저녁)의 장소별 도시
    day_plans: { date: string; city?: string; places: { name: string; category: string; city?: string; reason: string }[] }[];
  }>('/ai/generate', {
    city,
    dates,
    day_cities: dayCities,
    ...(travelStyle ? { style: travelStyle } : {}),
    ...(hotelName ? { hotel_name: hotelName } : {}),
    ...(mustVisit && mustVisit.length > 0 ? { must_visit: mustVisit } : {}),
    // 첫날·마지막날 가용시간 — ai-server가 반나절/귀국일 장소 수를 차등 결정
    ...(arrivalTime ? { arrival_time: arrivalTime } : {}),
    ...(dates.length > 1 && departureTime ? { departure_time: departureTime } : {}),
  });

  let totalAdded = 0;
  let totalFailed = 0;

  // 장소를 채울(skip이 아닌) 날짜만 카운트 — 진행률 N/M 표시용
  const fillableDates = res.data.day_plans.filter((dp) => dp.places && dp.places.length > 0).map((dp) => dp.date);
  let dayCounter = 0;

  for (const dp of res.data.day_plans) {
    // skip day — AI가 places를 빈 배열로 반환 → 이동/귀국일이므로 그냥 건너뜀
    if (!dp.places || dp.places.length === 0) continue;
    const existing = dayPlans.find((d) => d.date === dp.date);
    const hasNormal = existing?.places.some((p) => !p.slotType) ?? false;
    const isRegen = regenSet.has(dp.date);
    // 이미 장소가 있는 날은 기본 건너뜀. 단 재생성 대상이면 기존 일반 장소를 비우고 다시 채운다(슬롯 유지)
    if (hasNormal && !isRegen) continue;
    if (hasNormal && isRegen && existing) {
      reorderDayPlan(dp.date, existing.places.filter((p) => p.slotType));
    }

    dayCounter++;
    // 절대 'N일차'는 마지막날만 재생성 시 어색 — 첫날/마지막날은 상대 표현으로 표시
    const dayLabel = relativeDayLabel(dp.date, dates);
    const dayProgress = { current: dayCounter, total: fillableDates.length };
    onProgress?.(`${dayLabel} 장소를 조회하는 중이에요...`, dayProgress);

    // dp.city: AI가 날짜별로 반환하는 도시명. 빈 문자열이면 dayCities 매핑 → 기본 city 순으로 fallback
    // 단 "교토→오사카"처럼 화살표가 섞인 다중 도시는 resolve에 그대로 쓰면 geocode가 실패하므로
    // 날짜 대표값으로는 첫 도시만 폴백에 쓰고, 실제 도시는 아래 place.city를 우선한다
    // dayCities 값엔 "오사카 (오사카 성)"처럼 날짜 지정 장소가 괄호로 붙을 수 있어 괄호도 제거한다
    const dayCityRaw = dp.city || dayCities[dp.date] || city;
    const dayCityFallback = dayCityRaw.split('→')[0].split('(')[0].trim() || city;
    const resolvedPlaces: GooglePlace[] = [];

    for (const place of dp.places) {
      try {
        // 장소별 도시(place.city)가 있으면 우선 — 하루 내 도시 전환 시 각 장소를 올바른 도시로 검색
        const resolveCity = place.city?.trim() || dayCityFallback;
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

    // 동선 검증/교정 — sort 전에 고립 장소를 가까운 실재 장소로 교체.
    // resolve가 이미 스토어에 추가했고, sort 성공 시 아래 reorderDayPlan이 그 날을 교체본으로 덮어쓴다.
    // 단 sort에 못 들어가거나(2곳 미만) 실패하면 원본이 남으므로, 교체가 있었으면 별도 동기화한다.
    let replaced = false;
    if (resolvedPlaces.length >= 3) {
      const outlierIdx = detectOutlierIndices(resolvedPlaces);
      if (outlierIdx.length > 0) {
        onProgress?.(`${dayLabel} 동선에서 벗어난 장소를 가까운 곳으로 바꾸는 중이에요...`, dayProgress);
        // must_visit·슬롯은 사용자 의도/고정 장소라 교체 금지. 교체 후보 중복 방지용 현재 place_id 집합
        const protectedNames = new Set((mustVisit ?? []).map((n) => n.trim()));
        const currentIds = new Set(resolvedPlaces.map((p) => p.place_id));
        const outlierSet = new Set(outlierIdx);
        // anchor = 고립이 아닌 장소들 — 이들의 중심이 '진짜 그 날 동선'의 위치
        const anchors = resolvedPlaces.filter((_, i) => !outlierSet.has(i));
        for (const idx of outlierIdx) {
          const target = resolvedPlaces[idx];
          if (target.slotType || protectedNames.has(target.name.trim())) continue;
          const replacement = await findNearbyReplacement(target, anchors, currentIds);
          if (replacement) {
            currentIds.delete(target.place_id);
            currentIds.add(replacement.place_id);
            resolvedPlaces[idx] = replacement;
            replaced = true;
          }
        }
      }
    }

    if (resolvedPlaces.length >= 2) {
      try {
        onProgress?.(`${dayLabel} 동선을 정렬하고 이동 거점을 찾는 중이에요...`, dayProgress);
        // 재생성일은 위에서 일반 장소를 이미 비웠으므로 슬롯만 기준으로 삼는다 —
        // 옛 normal 장소가 섞인 스냅샷을 쓰면 firstNormalIdx slice가 지운 장소를 되살린다
        const existingPlaces = isRegen
          ? (existing?.places ?? []).filter((p) => p.slotType)
          : existing?.places ?? [];
        const dayIndex = dayPlans.findIndex((d) => d.date === dp.date);
        const isFirst = dayIndex === 0;
        const isLast = dayIndex === dayPlans.length - 1;

        // 첫날만 도착 공항(airport_arrive)을 앞에 붙여 공항→첫 관광지 구간에도 하차역을 넣는다
        // 마지막날 after 공항(귀국편)은 한국 공항이므로 anchor 불가 — 수백km 떨어져 거리 판단이 무의미
        const airportArrive = existingPlaces.find((p) => p.slotType === 'airport_arrive');
        const anchorBefore = isFirst && airportArrive ? airportArrive : null;

        // 먼저 동선 정렬 — 역 삽입은 정렬 확정된 순서의 인접 구간 기준이어야 한다.
        // (정렬 전 순서로 역을 끼우면 sort가 관광지를 재배치할 때 역이 엉뚱한 구간에 남는다)
        const sortRes = await nestApi.post<{ places: { place: GooglePlace; time_slot: string; transit_mode?: TransitMode | null }[] }>(
          '/ai/sort',
          { places: resolvedPlaces, date: dp.date },
        );
        const sortedPlaces = sortRes.data.places.map((item) => ({ ...item.place, timeSlot: item.time_slot, transitMode: item.transit_mode }));

        // 정렬된 순서에 anchor를 앞에 붙여 구간별 하차역 삽입 — anchor는 삽입 기준에만 사용, 결과에서 제거
        const placesForTransit = [
          ...(anchorBefore ? [anchorBefore] : []),
          ...sortedPlaces,
        ];
        const withTransitFull = await insertTransitStops(placesForTransit);
        const slotPlaces = anchorBefore
          ? withTransitFull.filter((p) => p.place_id !== anchorBefore.place_id)
          : withTransitFull;
        const firstNormalIdx = existingPlaces.findIndex((p) => !p.slotType);
        const lastNormalIdx = existingPlaces.map((p, i) => (!p.slotType ? i : -1)).filter((i) => i !== -1).at(-1) ?? -1;
        let beforeSlots: typeof existingPlaces;
        let afterSlots: typeof existingPlaces;
        if (firstNormalIdx === -1) {
          if (isFirst) {
            beforeSlots = existingPlaces.filter((p) => p.slotType === 'airport_depart' || p.slotType === 'airport_arrive');
            afterSlots = existingPlaces.filter((p) => p.slotType === 'hotel');
          } else if (isLast) {
            // 마지막날 귀국: 현지 출국(arrive) → 집 도착(depart) 순서로 뒤에 배치
            beforeSlots = existingPlaces.filter((p) => p.slotType === 'hotel');
            const arrive = existingPlaces.filter((p) => p.slotType === 'airport_arrive');
            const depart = existingPlaces.filter((p) => p.slotType === 'airport_depart');
            afterSlots = [...arrive, ...depart];
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
        replaced = false; // sort가 교체본까지 반영 완료 — 아래 동기화 불필요
      } catch {
        // 정렬 실패 — 교체본은 아래 동기화에서 반영(replaced 유지)
      }
    }

    // sort에 못 들어갔거나(2곳 미만) sort가 실패한 경우의 교체 동기화.
    // resolve가 추가한 원본 고립 장소가 스토어에 남아 있으므로 교체본으로 덮어쓴다.
    // sort 성공 시엔 위에서 replaced=false로 꺼져 이 블록을 건너뛴다.
    // 정렬·역삽입은 없는 폴백 경로라 슬롯(공항·호텔)을 앞에 두고 교체본을 잇는 단순 재구성으로 충분.
    if (replaced) {
      const slots = (existing?.places ?? []).filter((p) => p.slotType);
      reorderDayPlan(dp.date, [...slots, ...resolvedPlaces]);
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
  const setAiBusy = usePlanStore((s) => s.setAiBusy);
  const hotelName = usePlanStore((s) => s.tripConfig.hotel?.name ?? null);
  // 항공편 시각 — 첫날·마지막날 가용시간 신호로 chat/generate 요청에 첨부
  const arrivalTime = usePlanStore((s) => s.tripConfig.arrivalTime);
  const departureTime = usePlanStore((s) => s.tripConfig.departureTime);
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
        ? `안녕하세요. **${city}** 여행을 준비하고 계시는군요.\n맛집, 관광지, 교통 팁까지 무엇이든 물어보세요. 직접 다녀온 경험을 바탕으로 도와드리겠습니다.`
        : '안녕하세요. 여행지를 먼저 선택해 주세요.\n도시가 정해지면 맞춤 일정과 실용적인 팁을 바로 안내해 드릴 수 있습니다.',
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
        ? `안녕하세요. **${city}** 여행을 준비하고 계시는군요.\n맛집, 관광지, 교통 팁까지 무엇이든 물어보세요.`
        : '안녕하세요. 여행지를 먼저 선택해 주세요.\n도시가 정해지면 맞춤 일정과 실용적인 팁을 바로 안내해 드릴 수 있습니다.',
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

  // 생성 확인 카드의 [생성] 클릭 시 — generate action으로 전체 일정 자동생성 실행
  async function runGenerate(generate: GenerateAction) {
    if (loading) return;
    const targetCity = generate.city || city;
    if (dayPlans.length === 0) return;

    // AI가 추출한 날짜별 도시를 스토어에 반영 (다도시 일정)
    const merged = { ...dayCities, ...(generate.day_cities ?? {}) };
    if (generate.day_cities && Object.keys(generate.day_cities).length > 0) setDayCities(merged);

    const regenDates = generate.regenerate_dates ?? [];
    const isRegen = regenDates.length > 0;

    setLoading(true);
    setAiBusy(true);
    setMessages((prev) => [
      ...prev,
      {
        role: 'ai',
        text: isRegen
          // 단일 날짜 재생성이면 상대 라벨(첫날·마지막날)로, 여러 날이면 개수로 안내
          ? (regenDates.length === 1
              ? `${relativeDayLabel(regenDates[0], dayPlans.map((d) => d.date))} 일정을 다시 짜고 있어요...`
              : `${regenDates.length}개 날짜를 비우고 다시 짜고 있어요...`)
          : `**${targetCity}** ${dayPlans.length}일 일정을 생성하고 있어요...`,
        timestamp: nowHHMM(),
        isPending: true,
      },
    ]);
    const updateLast = (t: string, progress?: { current: number; total: number }) =>
      setMessages((prev) => prev.map((m, idx) => (idx === prev.length - 1 ? { ...m, text: t, progress } : m)));
    try {
      const { totalAdded, totalFailed } = await runFullGenerate(
        targetCity, dayPlans, generate.style ?? travelStyle, merged,
        addPlaceToDayPlan, reorderDayPlan, hotelName, updateLast, generate.must_visit, regenDates,
        arrivalTime, departureTime,
      );
      const resultText = totalAdded === 0
        ? '장소 정보를 가져오지 못했어요. 다시 시도해 주세요.'
        : totalFailed > 0
          ? `${totalAdded}개 장소를 일정에 추가했어요. (${totalFailed}개는 찾을 수 없어 건너뛰었어요)`
          : `${totalAdded}개 장소를 날짜별로 배치하고 동선까지 정렬했어요. 일정 패널에서 확인해보세요!`;
      setMessages((prev) => prev.map((m, idx) => (idx === prev.length - 1 ? { ...m, text: resultText, isPending: false, progress: undefined } : m)));
    } catch {
      setMessages((prev) =>
        prev.map((m, idx) => (idx === prev.length - 1
          ? { ...m, text: '일정 자동생성에 실패했어요. 잠시 후 다시 시도해 주세요.', isError: true, isPending: false, progress: undefined }
          : m)),
      );
    } finally {
      setAiBusy(false);
      setLoading(false);
    }
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

    // 자동생성·다도시 의도 분류는 ai-server Agent의 generate_full_itinerary tool이 담당한다.
    // (정규식 하드코딩 분기 제거 — LLM이 대화 문맥으로 판단 후 generate action 반환 → 확인 카드 → runGenerate)

    const controller = new AbortController();
    abortRef.current = controller;

    // 첫날엔 현지 도착 시각, 마지막날엔 출국 시각을 붙여 ai-server가 반나절/귀국일을 판단하게 한다.
    // 슬롯(공항·호텔)은 컨텍스트에서 빼지만, 시각 신호로 첫날·마지막날 가용시간은 전달된다.
    const lastIdx = dayPlans.length - 1;
    const dayPlansPayload = dayPlans.map((dp, i) => ({
      date: dp.date,
      places: dp.places.filter((p) => !p.slotType).map((p) => ({
        name: p.name,
        lat: p.location?.lat,
        lng: p.location?.lng,
      })),
      ...(i === 0 && arrivalTime ? { arrival_time: arrivalTime } : {}),
      ...(i === lastIdx && lastIdx > 0 && departureTime ? { departure_time: departureTime } : {}),
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

  return { messages, setMessages, loading, travelStyle, setTravelStyle, sendMessage, reset, cancel, runGenerate };
}
