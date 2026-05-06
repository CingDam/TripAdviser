// 일자별 색상 팔레트 — PlanContainer / MapContainer 공통 사용
// 여행 일수가 많아도 구분되도록 12색 준비
// 다크 맵에서도 뚜렷하게 보이도록 채도 높은 색상 선택 — 유사 색조 연속 배치 금지
export const DAY_COLORS = [
  '#EF4444', // 레드 — 1일차는 가장 눈에 띄는 색
  '#2563EB', // 오션블루
  '#16A34A', // 그린
  '#F59E0B', // 앰버
  '#7C3AED', // 바이올렛
  '#0891B2', // 시안
  '#EA580C', // 오렌지
  '#DB2777', // 핑크
  '#0D9488', // 틸
  '#65A30D', // 라임
  '#9333EA', // 퍼플
  '#0369A1', // 다크블루
];

/** dayPlans 배열에서 날짜 문자열로 색상 반환 */
export function getDayColor(date: string, dayPlans: { date: string }[]): string {
  const index = dayPlans.findIndex((d) => d.date === date);
  if (index === -1) return DAY_COLORS[0];
  return DAY_COLORS[index % DAY_COLORS.length];
}
