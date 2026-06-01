// 마이페이지 일정 목록 카드용 요약 — GET /plan 응답 형태
export interface PlanSummary {
  planNum: number;
  planName: string;
  startDate: string | null;
  endDate: string | null;
  isPublic: number;
  // lat/lng — 수정 진입 시 해당 도시로 지도 초기 중심 설정
  city: { cityName: string; country: string; lat: number; lng: number } | null;
  // 장소 수 계산용 — placeId가 null이 아닌 항목만 카운트
  dayPlans: { placeId: string | null }[];
  createdAt: string;
}
