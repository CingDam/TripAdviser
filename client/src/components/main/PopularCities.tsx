'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';

const CITIES = [
  { name: '도쿄', country: '일본', tag: '문화·미식', image: '/cities/tokyo.jpg' },
  { name: '오사카', country: '일본', tag: '먹방·쇼핑', image: '/cities/osaka.jpg' },
  { name: '방콕', country: '태국', tag: '사원·야시장', image: '/cities/bangkok.jpg' },
  { name: '싱가포르', country: '싱가포르', tag: '도심·미식', image: '/cities/singapore.jpg' },
  { name: '파리', country: '프랑스', tag: '예술·낭만', image: '/cities/paris.jpg' },
  { name: '바르셀로나', country: '스페인', tag: '해변·건축', image: '/cities/barcelona.jpg' },
  { name: '뉴욕', country: '미국', tag: '쇼핑·도심', image: '/cities/newyork.jpg' },
  { name: '하와이', country: '미국', tag: '해변·휴양', image: '/cities/hawaii.jpg' },
  { name: '시드니', country: '호주', tag: '자연·도심', image: '/cities/sydney.jpg' },
  { name: '발리', country: '인도네시아', tag: '리조트·자연', image: '/cities/bali.jpg' },
  { name: '제주', country: '대한민국', tag: '자연·힐링', image: '/cities/jeju.jpg' },
  { name: '프라하', country: '체코', tag: '역사·야경', image: '/cities/prague.jpg' },
];

const PopularCities = () => {
  return (
    <section id="popular" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* 섹션 헤더 */}
        <div className="mb-10">
          <p className="text-sm font-semibold text-indigo-600 mb-2">POPULAR DESTINATIONS</p>
          <h2 className="text-3xl font-extrabold text-gray-900">인기 여행지</h2>
          <p className="text-gray-500 mt-2">지금 가장 많이 계획되고 있는 도시들이에요</p>
        </div>

        {/* 그리드 레이아웃 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {CITIES.map((city, i) => (
            <Link
              key={i}
              href={`/plan?q=${encodeURIComponent(city.name)}`}
              className="group relative rounded-2xl overflow-hidden aspect-[3/5] cursor-pointer bg-gray-200"
            >
              {/* 로컬 이미지 경로 (/public 기준) */}
              <img
                src={city.image}
                alt={city.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />

              {/* 하단 그라데이션 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* 텍스트 정보 */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                <span className="text-[10px] font-bold bg-indigo-600/90 backdrop-blur-sm px-2 py-0.5 rounded-full w-fit mb-2 uppercase tracking-wider">
                  {city.tag}
                </span>
                <h3 className="text-lg font-bold leading-tight">{city.name}</h3>
                <div className="flex items-center gap-1 text-white/80 text-xs mt-1">
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