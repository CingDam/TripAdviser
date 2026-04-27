import CitiesClient from '@/components/main/CitiesClient';
import { type CityDto } from '@/constants/cities';

const CitiesPage = async () => {
  const nestUrl = process.env.NEXT_PUBLIC_NEST_URL ?? 'http://localhost:3001';
  let cities: CityDto[] = [];

  try {
    // 1시간 캐시 — PopularCities와 동일한 캐시 정책
    const res = await fetch(`${nestUrl}/api/city`, { next: { revalidate: 3600 } });
    if (res.ok) cities = (await res.json()) as CityDto[];
  } catch {
    // 서버 미응답 시 빈 목록으로 폴백
  }

  return (
    <main className="min-h-screen bg-white dark:bg-[#1c1c1e]">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* 페이지 헤더 */}
        <div className="mb-10">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-2 tracking-widest uppercase">
            All Destinations
          </p>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">여행지 전체보기</h1>
          <p className="text-gray-500 dark:text-white/40 mt-2">
            Planit이 지원하는 모든 도시를 탐색해보세요
          </p>
        </div>

        <CitiesClient cities={cities} />
      </div>
    </main>
  );
};

export default CitiesPage;
