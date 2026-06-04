// 두 장소 사이 이동시간을 직선거리로 근사 추정한다.
// Google Routes API를 호출하지 않으므로 추가 과금이 없다 — 좌표만으로 계산한다.

type LatLng = { lat: number; lng: number };

// server/src/place-search/place-search.service.ts의 haversineKm과 동일 공식
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // 지구 반지름(km)
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// 직선거리 → 실제 도보거리 보정. 직선으로 걸을 수 없으므로 약간 키운다
const DETOUR_FACTOR = 1.3;
// 평균 도보 속도(km/h) — 관광 중 느린 걸음 기준
const WALK_SPEED_KMH = 4.5;
// 이 거리(km)를 넘으면 도보가 비현실적 → 차량 이동으로 간주
const WALK_LIMIT_KM = 2;

export type WalkEstimate = {
  km: number;
  minutes: number;
  // 도보권을 벗어나 차량 이동이 적절한 거리인지
  isDrive: boolean;
};

// 좌표가 0,0(저장본 복원 등 미조회)이면 추정 불가 — null 반환
export function estimateWalk(a: LatLng, b: LatLng): WalkEstimate | null {
  if (!a.lat || !a.lng || !b.lat || !b.lng) return null;

  const straightKm = haversineKm(a, b);
  const km = straightKm * DETOUR_FACTOR;
  const minutes = Math.round((km / WALK_SPEED_KMH) * 60);
  return { km, minutes, isDrive: straightKm > WALK_LIMIT_KM };
}
