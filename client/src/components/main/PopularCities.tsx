import Link from 'next/link';
import Image from 'next/image';
import { MapPin } from 'lucide-react';

const CITIES = [
  { name: '도쿄',    country: '일본',      tag: '문화·미식',   image: '/cities/tokyo.jpg',       lat: 35.6762, lng: 139.6503 },
  { name: '오사카',  country: '일본',      tag: '먹방·쇼핑',   image: '/cities/osaka.jpg',       lat: 34.6937, lng: 135.5023 },
  { name: '방콕',    country: '태국',      tag: '사원·야시장', image: '/cities/bangkok.jpg',     lat: 13.7563, lng: 100.5018 },
  { name: '싱가포르',country: '싱가포르',   tag: '도심·미식',   image: '/cities/singapore.jpg',   lat:  1.3521, lng: 103.8198 },
  { name: '파리',    country: '프랑스',    tag: '예술·낭만',   image: '/cities/paris.jpg',       lat: 48.8566, lng:   2.3522 },
  { name: '바르셀로나', country: '스페인', tag: '해변·건축',   image: '/cities/barcelona.jpg',   lat: 41.3851, lng:   2.1734 },
  { name: '뉴욕',    country: '미국',      tag: '쇼핑·도심',   image: '/cities/newyork.jpg',     lat: 40.7128, lng: -74.0060 },
  { name: '하와이',  country: '미국',      tag: '해변·휴양',   image: '/cities/hawaii.jpg',      lat: 21.3069, lng:-157.8583 },
  { name: '시드니',  country: '호주',      tag: '자연·도심',   image: '/cities/sydney.jpg',      lat:-33.8688, lng: 151.2093 },
  { name: '발리',    country: '인도네시아', tag: '리조트·자연', image: '/cities/bali.jpg',        lat: -8.3405, lng: 115.0920 },
  { name: '제주',    country: '대한민국',  tag: '자연·힐링',   image: '/cities/jeju.jpg',        lat: 33.4996, lng: 126.5312 },
  { name: '프라하',  country: '체코',      tag: '역사·야경',   image: '/cities/prague.jpg',      lat: 50.0755, lng:  14.4378 },
];

const PopularCities = () => {
  return (
    <section id="popular" className="py-20 bg-white dark:bg-[#252527]">
      <div className="max-w-7xl mx-auto px-4">
        {/* 섹션 헤더 */}
        <div className="mb-10">
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-2 tracking-widest uppercase">Popular Destinations</p>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">인기 여행지</h2>
          <p className="text-gray-500 dark:text-white/40 mt-2">지금 가장 많이 계획되고 있는 도시들이에요</p>
        </div>

        {/* 그리드 레이아웃 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {CITIES.map((city, i) => (
            <Link
              key={i}
              href={`/plan?q=${encodeURIComponent(city.name)}&lat=${city.lat}&lng=${city.lng}`}
              className="group relative rounded-2xl overflow-hidden aspect-[3/5] cursor-pointer bg-gray-100 dark:bg-[#363638]"
            >
              <Image
                src={city.image}
                alt={city.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />

              {/* 하단 그라데이션 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* 텍스트 정보 */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                <span className="text-[10px] font-bold bg-white/10 backdrop-blur-sm border border-white/15 px-2 py-0.5 rounded-full w-fit mb-2 uppercase tracking-wider text-white/80">
                  {city.tag}
                </span>
                <h3 className="text-lg font-bold leading-tight">{city.name}</h3>
                <div className="flex items-center gap-1 text-white/50 text-xs mt-1">
                  <MapPin size={10} />
                  {city.country}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PopularCities;
