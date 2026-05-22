import { DayPlan } from '@/store/usePlanStore';

export function buildContextChips(dayPlans: DayPlan[], city: string): { label: string; text: string }[] {
  if (!city) return [];

  const chips: { label: string; text: string }[] = [];
  const normalPlaces = (dp: DayPlan) => dp.places.filter((p) => !p.slotType);

  const emptyDays = dayPlans.filter((dp) => normalPlaces(dp).length === 0);
  const lightDays = dayPlans.filter((dp) => {
    const n = normalPlaces(dp).length;
    return n > 0 && n < 3;
  });
  const hasPlans = dayPlans.some((dp) => normalPlaces(dp).length > 0);

  // 식당이 없는 날짜 — 가장 높은 우선순위 (식사 없는 날 불편)
  const noRestaurantDay = dayPlans.find((dp) => {
    const places = normalPlaces(dp);
    return places.length > 0 && !places.some((p) => p.types?.some((t) => t.includes('restaurant') || t.includes('food')));
  });

  // 관광지만 빽빽한 날짜 (4곳 이상, 카페·식당 없음)
  const tourismHeavyDay = dayPlans.find((dp) => {
    const places = normalPlaces(dp);
    const hasEat = places.some((p) => p.types?.some((t) => t.includes('restaurant') || t.includes('cafe') || t.includes('food')));
    return places.length >= 4 && !hasEat;
  });

  if (emptyDays.length > 0 && emptyDays.length < dayPlans.length) {
    // 일부 날짜만 비어있음 — 첫 번째 빈 날 집중 안내
    const idx = dayPlans.indexOf(emptyDays[0]) + 1;
    chips.push({ label: `📅 Day ${idx} 코스`, text: `${idx}일차 하루 코스 짜줘` });
  }

  if (emptyDays.length === dayPlans.length && dayPlans.length > 0) {
    // 전체 일정이 비어있음
    chips.push({ label: '🗺 전체 코스', text: '전체 여행 코스 짜줘' });
  }

  if (noRestaurantDay) {
    // 식당 없는 날 맛집 추천
    const idx = dayPlans.indexOf(noRestaurantDay) + 1;
    chips.push({ label: `🍜 ${idx}일차 맛집`, text: `${idx}일차 점심·저녁 맛집 추천해줘` });
  } else if (hasPlans) {
    chips.push({ label: '🍜 맛집 추천', text: '근처 맛집 추천해줘' });
  } else {
    chips.push({ label: '📍 맛집 추천', text: `${city} 맛집 추천해줘` });
  }

  if (tourismHeavyDay) {
    // 관광지만 많은 날 — 쉬어가는 카페 제안
    const idx = dayPlans.indexOf(tourismHeavyDay) + 1;
    chips.push({ label: `☕ ${idx}일차 카페`, text: `${idx}일차에 쉬어갈 카페 추천해줘` });
  } else if (lightDays.length > 0) {
    // 장소가 적은 날 — 더 채우기
    const idx = dayPlans.indexOf(lightDays[0]) + 1;
    chips.push({ label: `➕ ${idx}일차 더`, text: `${idx}일차에 추가할 장소 추천해줘` });
  }

  if (chips.length < 3) chips.push({ label: '🏛 관광 명소', text: `${city} 꼭 가봐야 할 관광 명소 알려줘` });
  if (chips.length < 4) chips.push({ label: '☕ 카페 추천', text: '분위기 좋은 카페 추천해줘' });

  return chips.slice(0, 4);
}

export function buildFollowUpChips(reply: string, hasAction: boolean): string[] {
  if (hasAction) {
    return ['주변 카페도 추천해줘', '이동 동선 어떻게 해?'];
  }

  const lower = reply.toLowerCase();
  const followUps: string[] = [];

  if (lower.includes('맛집') || lower.includes('식당') || lower.includes('음식') || lower.includes('레스토랑')) {
    followUps.push('일정에 추가해줘');
    followUps.push('카페도 같이 추천해줘');
  } else if (lower.includes('관광') || lower.includes('명소') || lower.includes('박물관') || lower.includes('미술관') || lower.includes('신사') || lower.includes('절') || lower.includes('궁')) {
    followUps.push('일정에 추가해줘');
    followUps.push('입장료·운영시간 알려줘');
  } else if (lower.includes('카페') || lower.includes('디저트') || lower.includes('커피')) {
    followUps.push('일정에 추가해줘');
    followUps.push('맛집도 같이 추천해줘');
  } else if (lower.includes('쇼핑') || lower.includes('백화점') || lower.includes('시장') || lower.includes('면세')) {
    followUps.push('일정에 추가해줘');
    followUps.push('근처 맛집도 알려줘');
  } else if (lower.includes('교통') || lower.includes('이동') || lower.includes('버스') || lower.includes('지하철') || lower.includes('철도') || lower.includes('ic카드') || lower.includes('패스')) {
    followUps.push('어디서 살 수 있어?');
    followUps.push('이동 시간 얼마나 걸려?');
  } else if (lower.includes('날씨') || lower.includes('기후') || lower.includes('계절') || lower.includes('우기') || lower.includes('더위') || lower.includes('추위')) {
    followUps.push('뭘 챙겨가야 해?');
    followUps.push('실내 관광지 추천해줘');
  } else if (lower.includes('환율') || lower.includes('엔화') || lower.includes('바트') || lower.includes('유로') || lower.includes('달러') || lower.includes('환전')) {
    followUps.push('현지에서 환전 어디서 해?');
    followUps.push('카드 쓸 수 있어?');
  } else if (lower.includes('숙소') || lower.includes('호텔') || lower.includes('료칸') || lower.includes('게스트하우스')) {
    followUps.push('추천 지역 어디야?');
    followUps.push('근처 관광지 뭐 있어?');
  }

  if (followUps.length === 0) {
    followUps.push('더 자세히 알려줘');
    followUps.push('다른 추천도 해줘');
  }

  return followUps.slice(0, 2);
}
