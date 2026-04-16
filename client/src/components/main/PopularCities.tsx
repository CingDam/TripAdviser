import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, MapPin } from 'lucide-react';
import FadeIn from '@/components/common/FadeIn';
import { CITY_TAGS, LOCAL_IMAGES, type CityDto } from '@/constants/cities';

// 메인 페이지에 노출할 최대 도시 수
const PREVIEW_COUNT = 8;

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

  const preview = cities.slice(0, PREVIEW_COUNT);
  const hasMore = cities.length > PREVIEW_COUNT;

  return (
    <section id="popular" className="py-20 bg-white dark:bg-[#252527]">
      <div className="max-w-7xl mx-auto px-4">
        {/* 섹션 헤더 */}
        <FadeIn className="flex items-end justify-between mb-10">
          <div>
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-2 tracking-widest uppercase">
              Popular Destinations
            </p>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">인기 여행지</h2>
            <p className="text-gray-500 dark:text-white/40 mt-2">
              지금 가장 많이 계획되고 있는 도시들이에요
            </p>
          </div>
          {hasMore && (
            <Link
              href="/cities"
              className="flex items-center gap-1.5 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors shrink-0 mb-1"
            >
              전체보기
              <ArrowRight size={15} />
            </Link>
          )}
        </FadeIn>

        {/* 그리드 레이아웃 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {preview.map((city, i) => {
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

        {/* 더보기 버튼 — 모바일에서는 텍스트 링크 대신 버튼으로 강조 */}
        {hasMore && (
          <FadeIn className="mt-8 flex justify-center">
            <Link
              href="/cities"
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-gray-200 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-white/70 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500/60 dark:hover:text-violet-400 transition-all"
            >
              여행지 전체보기 ({cities.length}개)
              <ArrowRight size={15} />
            </Link>
          </FadeIn>
        )}
      </div>
    </section>
  );
};

export default PopularCities;
