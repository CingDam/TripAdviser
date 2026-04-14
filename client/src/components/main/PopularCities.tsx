import Link from 'next/link';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import FadeIn from '@/components/common/FadeIn';

interface CityDto {
  cityNum: number;
  cityName: string;
  country: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
  planCount: number;
}

// 도시명 → 태그 로컬 매핑 (DB에 없는 필드)
const CITY_TAGS: Record<string, string> = {
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
const LOCAL_IMAGES: Record<string, string> = {
  도쿄: '/cities/tokyo.jpg',
  오사카: '/cities/osaka.jpg',
  방콕: '/cities/bangkok.jpg',
  싱가포르: '/cities/singapore.jpg',
  파리: '/cities/paris.jpg',
  바르셀로나: '/cities/barcelona.jpg',
  발리: '/cities/bali.jpg',
  제주: '/cities/jeju.jpg',
};

// plan_count가 동일하면 도시 순서가 흔들리지 않도록 DB 정렬(plan_count DESC)을 그대로 신뢰
const PopularCities = async () => {
  const nestUrl = process.env.NEXT_NEST_URL ?? 'http://localhost:3001';
  let cities: CityDto[] = [];

  try {
    // 1시간 캐시 — plan_count는 자주 바뀌지 않음
    const res = await fetch(`${nestUrl}/api/city`, { next: { revalidate: 3600 } });
    if (res.ok) cities = (await res.json()) as CityDto[];
  } catch {
    // 서버 미응답 시 빈 목록으로 폴백 — 섹션 자체는 렌더됨
  }

  return (
    <section id="popular" className="py-20 bg-white dark:bg-[#252527]">
      <div className="max-w-7xl mx-auto px-4">
        {/* 섹션 헤더 */}
        <FadeIn className="mb-10">
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-2 tracking-widest uppercase">
            Popular Destinations
          </p>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">인기 여행지</h2>
          <p className="text-gray-500 dark:text-white/40 mt-2">
            지금 가장 많이 계획되고 있는 도시들이에요
          </p>
        </FadeIn>

        {/* 그리드 레이아웃 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {cities.map((city, i) => {
            const imageSrc = city.imageUrl ?? LOCAL_IMAGES[city.cityName] ?? null;
            const tag = CITY_TAGS[city.cityName] ?? '';

            return (
              // 4열 기준 한 행씩 등장 — 열 인덱스로 stagger, 최대 225ms
              <FadeIn key={city.cityNum} delay={(i % 4) * 75}>
                <Link
                  href={`/plan?q=${encodeURIComponent(city.cityName)}&lat=${city.lat}&lng=${city.lng}`}
                  className="group relative rounded-2xl overflow-hidden aspect-[3/5] cursor-pointer bg-gray-100 dark:bg-[#363638] block"
                >
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={city.cityName}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    // imageUrl도 로컬 이미지도 없는 도시 — 그라디언트 플레이스홀더
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-violet-500" />
                  )}

                  {/* 하단 그라데이션 오버레이 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* 텍스트 정보 */}
                  <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                    {tag && (
                      <span className="text-[10px] font-bold bg-white/10 backdrop-blur-sm border border-white/15 px-2 py-0.5 rounded-full w-fit mb-2 uppercase tracking-wider text-white/80">
                        {tag}
                      </span>
                    )}
                    <h3 className="text-lg font-bold leading-tight">{city.cityName}</h3>
                    <div className="flex items-center gap-1 text-white/50 text-xs mt-1">
                      <MapPin size={10} />
                      {city.country}
                    </div>
                    {city.planCount > 0 && (
                      <div className="text-[10px] text-white/40 mt-0.5">
                        일정 {city.planCount.toLocaleString()}개
                      </div>
                    )}
                  </div>
                </Link>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PopularCities;
