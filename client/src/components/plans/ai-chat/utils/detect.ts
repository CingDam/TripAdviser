// nearby 키워드 → 카테고리 매핑
const NEARBY_KEYWORD_MAP: { keywords: string[]; category: string }[] = [
  { keywords: ['맛집', '식당', '음식', '밥', '점심', '저녁', '먹을', '먹자', '뭐 먹', '레스토랑'], category: '식당' },
  { keywords: ['카페', '커피', '디저트', '케이크', '브런치'], category: '카페' },
  { keywords: ['관광', '명소', '볼거리', '관광지', '구경', '박물관', '미술관'], category: '관광지' },
  { keywords: ['쇼핑', '쇼핑몰', '백화점', '면세점', '마트', '시장'], category: '쇼핑' },
];

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
