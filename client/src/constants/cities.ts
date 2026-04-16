export interface CityDto {
  cityNum: number;
  cityName: string;
  country: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
  planCount: number;
}

// 도시명 → 태그 로컬 매핑 (DB에 없는 필드)
export const CITY_TAGS: Record<string, string> = {
  서울: '도심·문화',
  부산: '해변·미식',
  제주: '자연·힐링',
  도쿄: '문화·미식',
  오사카: '먹방·쇼핑',
  후쿠오카: '라멘·온천',
  교토: '전통·사찰',
  삿포로: '자연·설경',
  방콕: '사원·야시장',
  싱가포르: '도심·미식',
  발리: '리조트·자연',
  다낭: '해변·휴양',
  파리: '예술·낭만',
  로마: '역사·유적',
  바르셀로나: '해변·건축',
};

// 도시명 → 로컬 이미지 경로 매핑 (DB imageUrl이 null일 때 폴백)
export const LOCAL_IMAGES: Record<string, string> = {
  도쿄: '/cities/tokyo.jpg',
  오사카: '/cities/osaka.jpg',
  방콕: '/cities/bangkok.jpg',
  싱가포르: '/cities/singapore.jpg',
  파리: '/cities/paris.jpg',
  바르셀로나: '/cities/barcelona.jpg',
  발리: '/cities/bali.jpg',
  제주: '/cities/jeju.jpg',
};

// 지역 필터 탭 — country 값과 매핑
export const REGION_FILTERS: { label: string; countries: string[] | null }[] = [
  { label: '전체', countries: null },
  { label: '국내', countries: ['한국'] },
  { label: '일본', countries: ['일본'] },
  { label: '동남아', countries: ['태국', '싱가포르', '인도네시아', '베트남', '말레이시아', '필리핀', '캄보디아'] },
  { label: '유럽', countries: ['프랑스', '이탈리아', '스페인', '영국', '독일', '네덜란드', '포르투갈', '스위스', '오스트리아', '체코', '그리스', '터키'] },
  { label: '북미', countries: ['미국', '캐나다', '멕시코'] },
  { label: '중남미', countries: ['브라질', '아르헨티나', '페루', '칠레', '콜롬비아', '쿠바'] },
  { label: '중동·아프리카', countries: ['아랍에미리트', '사우디아라비아', '이스라엘', '요르단', '이집트', '모로코', '케냐', '탄자니아', '남아프리카공화국'] },
];
