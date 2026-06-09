import { DayPlan, GooglePlace } from '@/store/usePlanStore';

// 능동적 코칭 — 사용자가 일정을 직접 바꿀 때 챗봇이 먼저 띄우는 제안.
// AI 호출 없이 클라 휴리스틱으로만 판단한다(비용·지연 0).

// 동선 고립 판정 — 최근접 이웃까지 이 거리를 넘으면 외딴 장소로 본다.
// useChatMessages의 OUTLIER_NN_KM(3km)과 같은 기준 — 자동생성 동선 검증과 체감 일치시킴
const OUTLIER_NN_KM = 3;
// 하루 과밀 판정 — 일반 장소가 이 수를 넘으면 빡빡하다고 본다(식당·카페·교통·슬롯 제외 후)
const CROWDED_LIMIT = 8;

// 코칭 종류 — 같은 날 같은 종류는 한 번만 띄우기 위해 키로도 쓴다
export type CoachingKind = 'outlier' | 'noMeal' | 'noCafe' | 'crowded';

export interface CoachingSuggestion {
  kind: CoachingKind;
  date: string;
  // 챗봇 말풍선에 띄울 메시지(마크다운)
  message: string;
  // 사용자가 바로 누를 수 있는 후속 칩 — 누르면 그 문구로 챗봇에 질문
  followUp: string;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// 같은 날 일반 장소 중 동선상 고립된 것이 하나라도 있는지.
// 좌표가 있는(0,0이 아닌) 장소 3곳 이상일 때만 의미 있다.
function findOutlier(places: GooglePlace[]): GooglePlace | null {
  const located = places.filter((p) => p.location && (p.location.lat !== 0 || p.location.lng !== 0));
  if (located.length < 3) return null;
  for (const p of located) {
    let nearest = Infinity;
    for (const q of located) {
      if (p === q) continue;
      const d = haversineKm(p.location, q.location);
      if (d < nearest) nearest = d;
    }
    if (nearest > OUTLIER_NN_KM) return p;
  }
  return null;
}

// Day 인덱스(1-base) 라벨 — dayPlans 순서 기준
function dayLabel(dayPlans: DayPlan[], date: string): string {
  const idx = dayPlans.findIndex((d) => d.date === date);
  return `Day ${idx + 1}`;
}

// 한 날짜를 점검해 가장 우선순위 높은 코칭 제안 1개를 반환. 없으면 null.
// 우선순위: 동선 고립 > 식당 없음 > 카페 없음 > 과밀 (동선이 가장 치명적)
export function getCoachingForDate(dayPlans: DayPlan[], date: string): CoachingSuggestion | null {
  const day = dayPlans.find((d) => d.date === date);
  if (!day) return null;

  // 슬롯(공항·호텔)은 사용자가 짠 일정이 아니므로 코칭 판단에서 제외
  const normal = day.places.filter((p) => !p.slotType);
  if (normal.length < 3) return null; // 장소가 적으면 아직 판단할 단계가 아님

  const label = dayLabel(dayPlans, date);

  const outlier = findOutlier(normal);
  if (outlier) {
    return {
      kind: 'outlier',
      date,
      message: `**${label}** 일정에서 **${outlier.name}**가 다른 장소들과 다소 떨어져 있어요. 이대로면 이동이 많아질 수 있는데, 근처 다른 곳으로 바꿔드릴까요?`,
      followUp: `${label} 동선 정리해줘`,
    };
  }

  const mealCount = normal.filter((p) => p.category === '식당').length;
  if (mealCount === 0) {
    return {
      kind: 'noMeal',
      date,
      message: `**${label}**에 식사할 곳이 아직 없어요. 동선 중간에 넣기 좋은 맛집 몇 곳 추천해드릴까요?`,
      followUp: `${label}에 맛집 추천해줘`,
    };
  }

  const cafeCount = normal.filter((p) => p.category === '카페').length;
  if (cafeCount === 0) {
    return {
      kind: 'noCafe',
      date,
      message: `**${label}** 일정에 잠깐 쉬어갈 카페가 없어요. 오후에 한 곳 넣으면 동선에 여유가 생깁니다. 골라드릴까요?`,
      followUp: `${label}에 카페 추천해줘`,
    };
  }

  if (normal.length > CROWDED_LIMIT) {
    return {
      kind: 'crowded',
      date,
      message: `**${label}** 일정이 좀 빡빡해 보여요(${normal.length}곳). 체력 생각하면 한두 곳은 다른 날로 옮기거나 빼는 것도 좋아요. 어떻게 조정할지 같이 볼까요?`,
      followUp: `${label} 일정 좀 봐줘`,
    };
  }

  return null;
}
