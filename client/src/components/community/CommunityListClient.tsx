'use client';

import {
  useCallback,
  useMemo,
  useState,
  memo,
} from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, Eye, Heart, MapPin, PenSquare,
  Search,
} from 'lucide-react';
import { nestApi } from '@/config/api.config';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import Button from '@/components/common/Button';
import type { CityOption } from './CommunityWriteModal';

const CommunityWriteModal = dynamic(
  () => import('./CommunityWriteModal'),
  { ssr: false },
);

export interface CommunityPost {
  communityNum: number;
  title: string;
  content: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  user: { userNum: number; name: string };
  city: { cityName: string; country: string } | null;
}

export interface PagedCommunityResponse {
  data: CommunityPost[];
  total: number;
  page: number;
  limit: number;
}

function formatRelativeDate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (diff < MIN) return '방금 전';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < DAY * 7) return `${Math.floor(diff / DAY)}일 전`;
  const d = new Date(isoString);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const CityCard = memo(function CityCard({
  city,
  onSelect,
}: {
  city: CityOption;
  onSelect: (cityNum: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(city.cityNum)}
      className="relative overflow-hidden rounded-2xl cursor-pointer group h-28 w-full"
    >
      {city.imageUrl ? (
        <Image
          src={city.imageUrl}
          alt={city.cityName}
          fill
          // grid: base 4cols(50vw), sm 6cols, md 8cols, lg 10cols, xl 12cols(max-w-7xl 기준 ~205px)
          // col-span-2이므로 중간 브레이크포인트에서 ~220px로 충분 — next/image가 webp + 적정 해상도로 자동 변환
          sizes="(min-width: 640px) 220px, 50vw"
          className="object-cover transition-transform duration-300 group-hover:scale-110"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 p-2.5">
        <p className="text-white font-bold text-xs leading-tight">{city.cityName}</p>
        <p className="text-white/60 text-[10px]">{city.country}</p>
      </div>
    </button>
  );
});

const SkeletonPost = () => (
  <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 border border-gray-100 dark:border-white/8 flex flex-col gap-3">
    <div className="skeleton h-4 w-3/4 rounded-full" />
    <div className="skeleton h-3 w-full rounded-full" />
    <div className="skeleton h-3 w-1/2 rounded-full" />
    <div className="flex gap-3 mt-1">
      <div className="skeleton h-3 w-16 rounded-full" />
      <div className="skeleton h-3 w-16 rounded-full" />
    </div>
  </div>
);

const CommunityPostCard = memo(function CommunityPostCard({
  post,
  onOpen,
}: {
  post: CommunityPost;
  onOpen: (communityNum: number) => void;
}) {
  return (
    <div
      onClick={() => onOpen(post.communityNum)}
      className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 border border-gray-100 dark:border-white/8 shadow-sm hover:shadow-md dark:hover:border-white/12 transition-all cursor-pointer group"
    >
      <div className="flex flex-col gap-2">
        {post.city && (
          <span className="flex items-center gap-1 text-[11px] text-indigo-500 dark:text-indigo-400 font-semibold w-fit">
            <MapPin size={10} />
            {post.city.cityName}
          </span>
        )}
        <h3 className="text-sm font-bold text-gray-900 dark:text-white/90 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
          {post.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-white/40 line-clamp-2 leading-relaxed">
          {post.content}
        </p>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-white/30">
            <span className="font-medium text-gray-600 dark:text-white/50">{post.user.name}</span>
            <span>·</span>
            <span>{formatRelativeDate(post.createdAt)}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-white/30">
            <span className="flex items-center gap-1"><Eye size={12} />{post.viewCount}</span>
            <span className="flex items-center gap-1"><Heart size={12} />{post.likeCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

interface Props {
  initialPosts: PagedCommunityResponse;
  initialCities: CityOption[];
}

const PAGE_LIMIT = 20;

export default function CommunityListClient({ initialPosts, initialCities }: Props) {
  const router = useRouter();
  const { show } = useSnackbar();
  const token = useAuthStore((s) => s.token);

  // SSR이 첫 페이지를 채워주므로 isLoading은 false로 시작 — 마운트 후 추가 fetch 없음
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts.data);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPosts.page);
  const [hasMore, setHasMore] = useState(initialPosts.data.length < initialPosts.total);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cities] = useState<CityOption[]>(initialCities);

  // 글 작성 후 목록을 새로고침할 때만 사용 — 마운트 시 자동 호출 안 함
  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await nestApi.get<PagedCommunityResponse>('/community', {
        params: { page: 1, limit: PAGE_LIMIT },
      });
      setPosts(res.data.data);
      setCurrentPage(1);
      setHasMore(res.data.data.length < res.data.total);
    } catch {
      show('게시글을 불러오지 못했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [show]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const res = await nestApi.get<PagedCommunityResponse>('/community', {
        params: { page: nextPage, limit: PAGE_LIMIT },
      });
      setPosts((prev) => [...prev, ...res.data.data]);
      setCurrentPage(nextPage);
      setHasMore(posts.length + res.data.data.length < res.data.total);
    } catch {
      show('게시글을 불러오지 못했습니다', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, posts.length, show]);

  const cityChips = useMemo(
    () =>
      Array.from(
        new Map(
          posts
            .filter((p) => p.city !== null)
            .map((p) => [p.city!.cityName, p.city!]),
        ).values(),
      ),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      const matchCity = selectedCity === null || p.city?.cityName === selectedCity;
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.user.name.toLowerCase().includes(q);
      return matchCity && matchSearch;
    });
  }, [posts, selectedCity, searchQuery]);

  const handleCityNavigate = useCallback(
    (cityNum: number) => {
      router.push(`/city/${cityNum}`);
    },
    [router],
  );

  const handlePostOpen = useCallback(
    (communityNum: number) => {
      router.push(`/community/${communityNum}`);
    },
    [router],
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e]">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white/90">커뮤니티</h1>
            <p className="text-sm text-gray-400 dark:text-white/35 mt-1">여행자들의 이야기를 나눠보세요</p>
          </div>
          {token && (
            <Button variant="primary" onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 flex-shrink-0">
              <PenSquare size={14} />
              글쓰기
            </Button>
          )}
        </div>

        {cities.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white/80">목적지별 가이드</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
              {cities.map((city) => (
                <div key={city.cityNum} className="col-span-2">
                  <CityCard city={city} onSelect={handleCityNavigate} />
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="border-t border-gray-200 dark:border-white/8" />

        <section className="flex flex-col gap-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white/80">최신 여행 이야기</h2>

          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목 또는 작성자 검색"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-2xl bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {cityChips.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedCity(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border
                  ${selectedCity === null
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-indigo-600 dark:border-indigo-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 dark:bg-[#2c2c2e] dark:text-white/40 dark:border-white/8 dark:hover:border-white/20'
                  }`}
              >
                전체
              </button>
              {cityChips.map((city) => (
                <button
                  type="button"
                  key={city.cityName}
                  onClick={() => setSelectedCity(selectedCity === city.cityName ? null : city.cityName)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border
                    ${selectedCity === city.cityName
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 dark:bg-[#2c2c2e] dark:text-white/40 dark:border-white/8 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400'
                    }`}
                >
                  <MapPin size={10} />
                  {city.cityName}
                </button>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-3">
            {isLoading && (
              <>
                <SkeletonPost />
                <SkeletonPost />
                <SkeletonPost />
                <SkeletonPost />
              </>
            )}

            {!isLoading && filteredPosts.length === 0 && (
              <div className="lg:col-span-2 bg-white dark:bg-[#2c2c2e] rounded-2xl border border-gray-100 dark:border-white/8 p-16 flex flex-col items-center gap-3 text-gray-300 dark:text-white/20">
                <MessageSquare size={40} strokeWidth={1.5} />
                <span className="text-sm">
                  {searchQuery ? '검색 결과가 없습니다' : '아직 게시글이 없습니다'}
                </span>
              </div>
            )}

            {!isLoading &&
              filteredPosts.map((post) => (
                <CommunityPostCard key={post.communityNum} post={post} onOpen={handlePostOpen} />
              ))}
          </div>

          {/* 검색/필터 없을 때만 더 보기 노출 — 필터 결과는 이미 로드된 데이터에서 처리 */}
          {!isLoading && !searchQuery && selectedCity === null && hasMore && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                onClick={() => { void loadMore(); }}
                className="min-w-32"
              >
                {isLoadingMore ? '불러오는 중...' : '더 보기'}
              </Button>
            </div>
          )}
        </section>
      </div>

      <CommunityWriteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cities={cities}
        onPosted={loadPosts}
      />
    </main>
  );
}
