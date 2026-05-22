// "전체 일정 짜줘" 패턴 — N박M일, 전체 일정, 처음부터 등 전체 생성 의도 감지
const FULL_GENERATE_PATTERNS = [
  /(\d+)박(\d+)일/,
  /전체\s*일정/,
  /처음부터\s*(짜|만들|생성)/,
  /일정\s*(전체|다\s*)(짜|만들|생성)/,
  /모든\s*날(짜)?\s*(일정)?\s*(짜|만들|생성)/,
  /전부\s*(짜|만들|생성)/,
];

export function detectFullGenerate(text: string): boolean {
  return FULL_GENERATE_PATTERNS.some((re) => re.test(text));
}

// nearby 키워드 → 카테고리 매핑
const NEARBY_KEYWORD_MAP: { keywords: string[]; category: string }[] = [
  { keywords: ['맛집', '식당', '음식', '밥', '점심', '저녁', '먹을', '먹자', '뭐 먹', '레스토랑'], category: '식당' },
  { keywords: ['카페', '커피', '디저트', '케이크', '브런치'], category: '카페' },
  { keywords: ['관광', '명소', '볼거리', '관광지', '구경', '박물관', '미술관'], category: '관광지' },
  { keywords: ['쇼핑', '쇼핑몰', '백화점', '면세점', '마트', '시장'], category: '쇼핑' },
];

// 날짜 순서 표현 → 인덱스(0-based) 매핑
const DAY_INDEX_MAP: Record<string, number> = {
  첫날: 0, '1일차': 0, '1일': 0, 'day1': 0,
  둘째날: 1, '2일차': 1, '2일': 1, 'day2': 1,
  셋째날: 2, '3일차': 2, '3일': 2, 'day3': 2,
  넷째날: 3, '4일차': 3, '4일': 3, 'day4': 3,
  다섯째날: 4, '5일차': 4, '5일': 4, 'day5': 4,
  마지막날: -1, // 배열 마지막 날짜로 처리
};

/**
 * 사용자 메시지에서 "첫날 오사카, 둘째날 교토" 같은 날짜별 도시 매핑을 추출한다.
 * dayPlans가 있을 때만 의미가 있으므로 dates를 함께 받는다.
 * 반환값: { "2025-01-01": "오사카", ... } — 감지된 날짜만 포함, 없으면 빈 객체
 */
export function detectMultiCityPlan(text: string, dates: string[], cityKeywords: string[]): Record<string, string> {
  if (dates.length === 0 || cityKeywords.length === 0) return {};

  const lower = text.toLowerCase();
  const result: Record<string, string> = {};

  for (const [dayExpr, rawIdx] of Object.entries(DAY_INDEX_MAP)) {
    if (!lower.includes(dayExpr)) continue;
    const idx = rawIdx === -1 ? dates.length - 1 : rawIdx;
    if (idx >= dates.length) continue;

    // dayExpr 출현 위치 기준 앞뒤 15자 이내에서 도시명 탐색
    const pos = lower.indexOf(dayExpr);
    const window = lower.slice(Math.max(0, pos - 5), pos + dayExpr.length + 15);
    const matched = cityKeywords.find((c) => window.includes(c.toLowerCase()));
    if (matched) result[dates[idx]] = matched;
  }

  return result;
}

// DB에 없는 도시까지 감지하는 보조 목록 — /api/city 응답과 병합해 사용
export const FALLBACK_CITY_KEYWORDS: string[] = [
  '경주', '전주', '강릉', '인천',
  '나라', '나고야', '요코하마', '히로시마',
  '하노이', '호치민', '쿠알라룸푸르', '세부',
  '암스테르담', '프라하', '빈', '베를린',
  '뉴욕', '라스베가스', '하와이', '오아후', '마우이',
  '시드니', '멜버른',
];

export function detectCityInText(text: string, cityKeywords: string[]): string {
  const lower = text.toLowerCase();
  for (const city of cityKeywords) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  return '';
}

export function detectNearbyCategory(text: string): string {
  for (const { keywords, category } of NEARBY_KEYWORD_MAP) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return '';
}
