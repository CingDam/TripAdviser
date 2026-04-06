// 일자별 색상 팔레트 — PlanContainer / MapContainer 공통 사용
// 여행 일수가 많아도 구분되도록 12색 준비
export const DAY_COLORS = [
  '#4F46E5', // 인디고
  '#E54646', // 레드
  '#16A34A', // 그린
  '#D97706', // 앰버
  '#9333EA', // 퍼플
  '#0891B2', // 시안
  '#DB2777', // 핑크
  '#65A30D', // 라임
  '#EA580C', // 오렌지
  '#0284C7', // 스카이블루
  '#7C3AED', // 바이올렛
  '#047857', // 에메랄드
];

/** dayPlans 배열에서 날짜 문자열로 색상 반환 */
export function getDayColor(date: string, dayPlans: { date: string }[]): string {
  const index = dayPlans.findIndex((d) => d.date === date);
  if (index === -1) return DAY_COLORS[0];
  return DAY_COLORS[index % DAY_COLORS.length];
}
