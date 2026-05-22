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

// 해당 날에 관광 계획이 없는 이동/귀국 일을 나타내는 패턴
const SKIP_DAY_PATTERNS = [
  /바로\s*(공항|귀국|출발|이동)/,
  /공항으로\s*(바로|직접|바로\s*출발|바로\s*이동)/,
  /(귀국|출국|출발)\s*일/,
  /공항\s*(직행|직접|바로)/,
  /이동만\s*(할|하는|하고)/,
  /장소\s*(없|안)/,
  /자유\s*시간/,
];

/**
 * 사용자 메시지에서 "첫날 오사카, 둘째날 교토" 같은 날짜별 도시 매핑을 추출한다.
 * skip day("마지막날 바로 공항")는 "_skip" 값으로 반환한다.
 * 반환값: { "2025-01-01": "오사카", "2025-01-03": "_skip", ... }
 */
export function detectMultiCityPlan(text: string, dates: string[], cityKeywords: string[]): Record<string, string> {
  if (dates.length === 0 || cityKeywords.length === 0) return {};

  const result: Record<string, string> = {};
  const lowerText = text.toLowerCase();

  // 다음 날짜 표현 출현 위치 목록 — window가 다음 날짜 표현을 넘지 않도록 제한
  const allDayExprPositions: number[] = [];
  for (const dayExpr of Object.keys(DAY_INDEX_MAP)) {
    let searchFrom = 0;
    while (true) {
      const pos = lowerText.indexOf(dayExpr, searchFrom);
      if (pos === -1) break;
      allDayExprPositions.push(pos);
      searchFrom = pos + 1;
    }
  }
  allDayExprPositions.sort((a, b) => a - b);

  for (const [dayExpr, rawIdx] of Object.entries(DAY_INDEX_MAP)) {
    if (!lowerText.includes(dayExpr)) continue;
    const idx = rawIdx === -1 ? dates.length - 1 : rawIdx;
    if (idx >= dates.length) continue;

    const pos = lowerText.indexOf(dayExpr);

    // window 끝은 다음 날짜 표현 직전까지 — 다른 날의 내용이 섞이지 않도록
    const nextDayPos = allDayExprPositions.find((p) => p > pos) ?? pos + 50;
    const windowEnd = Math.min(nextDayPos, pos + 50);
    const window = text.slice(Math.max(0, pos - 5), windowEnd);

    // skip day 패턴 먼저 확인 — 공항/귀국 표현이 있으면 도시 탐색 없이 _skip
    if (SKIP_DAY_PATTERNS.some((re) => re.test(window))) {
      result[dates[idx]] = '_skip';
      continue;
    }

    const windowLower = window.toLowerCase();
    const matched = cityKeywords.find((c) => windowLower.includes(c.toLowerCase()));
    if (matched) result[dates[idx]] = matched;
  }

  return result;
}

// DB에 없는 도시까지 감지하는 보조 목록 — /api/city 응답과 병합해 사용
// DB 시드: 서울·부산·제주·도쿄·오사카·후쿠오카·교토·삿포로·방콕·싱가포르·발리·다낭·파리·로마·바르셀로나
// 아래는 DB에 없는 추가 도시 + DB 시드 도시도 포함 (초기 렌더 타이밍 전에 cityKeywords가 비어있을 때 fallback)
export const FALLBACK_CITY_KEYWORDS: string[] = [
  // 한국
  '서울', '부산', '제주', '경주', '전주', '강릉', '인천',
  // 일본
  '도쿄', '오사카', '교토', '후쿠오카', '삿포로',
  '나라', '나고야', '요코하마', '히로시마', '고베',
  // 동남아
  '방콕', '싱가포르', '발리', '다낭',
  '하노이', '호치민', '쿠알라룸푸르', '세부',
  // 유럽
  '파리', '로마', '바르셀로나',
  '암스테르담', '프라하', '빈', '베를린', '런던',
  // 미주
  '뉴욕', '라스베가스', '하와이', '오아후', '마우이',
  // 오세아니아
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
