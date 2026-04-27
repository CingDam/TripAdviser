'use client';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { CITY_TAGS, LOCAL_IMAGES, REGION_FILTERS, type CityDto } from '@/constants/cities';

const CitiesClient = ({ cities }: { cities: CityDto[] }) => {
  const [activeRegion, setActiveRegion] = useState<string>('전체');

  const filtered = activeRegion === '전체'
    ? cities
    : cities.filter((city) => {
        const region = REGION_FILTERS.find((r) => r.label === activeRegion);
        return region?.countries?.includes(city.country) ?? false;
      });

  return (
    <div>
      {/* 지역 필터 탭 */}
      <div className="flex gap-2 flex-wrap mb-8">
        {REGION_FILTERS.map((region) => (
          <button
            key={region.label}
            onClick={() => setActiveRegion(region.label)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all cursor-pointer
              ${activeRegion === region.label
                ? 'bg-rose-600 border-rose-600 text-white'
                : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/50 hover:border-rose-400 hover:text-rose-600 dark:hover:border-rose-500/60 dark:hover:text-rose-400'
              }`}
          >
            {region.label}
            <span className={`ml-1.5 text-xs ${activeRegion === region.label ? 'text-white/70' : 'text-gray-400 dark:text-white/25'}`}>
              {region.countries === null
                ? cities.length
                : cities.filter((c) => region.countries!.includes(c.country)).length}
            </span>
          </button>
        ))}
      </div>

      {/* 도시 그리드 */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-400 dark:text-white/30 text-sm">
          해당 지역의 도시가 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((city) => {
            const imageSrc = city.imageUrl ?? LOCAL_IMAGES[city.cityName] ?? null;
            const tag = CITY_TAGS[city.cityName] ?? '';

            return (
              <Link
                key={city.cityNum}
                href={`/plan?q=${encodeURIComponent(city.cityName)}&lat=${city.lat}&lng=${city.lng}`}
                className="group relative rounded-2xl overflow-hidden aspect-[3/4] cursor-pointer bg-gray-100 dark:bg-[#363638] block"
              >
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt={city.cityName}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-400 to-pink-500" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute inset-0 flex flex-col justify-end p-3 text-white">
                  {tag && (
                    <span className="text-[10px] font-bold bg-white/10 backdrop-blur-sm border border-white/15 px-2 py-0.5 rounded-full w-fit mb-1.5 uppercase tracking-wider text-white/80">
                      {tag}
                    </span>
                  )}
                  <h3 className="text-base font-bold leading-tight">{city.cityName}</h3>
                  <div className="flex items-center gap-1 text-white/50 text-xs mt-0.5">
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CitiesClient;
