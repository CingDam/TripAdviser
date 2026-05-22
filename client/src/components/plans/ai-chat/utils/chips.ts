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

  if (emptyDays.length > 0 && emptyDays.length < dayPlans.length) {
    const idx = dayPlans.indexOf(emptyDays[0]) + 1;
    chips.push({ label: `📅 Day ${idx} 코스`, text: `Day ${idx} 하루 코스 짜줘` });
  }

  if (emptyDays.length === dayPlans.length && dayPlans.length > 0) {
    chips.push({ label: '🗺 전체 코스', text: '여행 코스 짜줘' });
  }

  if (hasPlans) {
    chips.push({ label: '🍜 맛집 추천', text: '근처 맛집 추천해줘' });
  } else {
    chips.push({ label: '📍 맛집 추천', text: '맛집 추천해줘' });
  }

  if (lightDays.length > 0) {
    const idx = dayPlans.indexOf(lightDays[0]) + 1;
    chips.push({ label: `➕ Day ${idx} 더 채우기`, text: `Day ${idx}에 추가할 장소 추천해줘` });
  }

  if (chips.length < 3) chips.push({ label: '🏛 관광 명소', text: '꼭 가봐야 할 관광 명소 알려줘' });
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
