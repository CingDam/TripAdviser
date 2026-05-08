'use client';

import {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
  memo,
} from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import PublicPlanSlider from '@/components/plans/PublicPlanSlider';
import {
  MessageSquare, Eye, Heart, MapPin, PenSquare,
  Search, TrendingUp, Clock,
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
        <div className="w-full h-full bg-gradient-to-br from-rose-400 to-pink-600" />
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
  <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 border border-[#2563EB]/20 dark:border-white/8 flex flex-col gap-3">
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
      className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 border border-[#2563EB]/20 dark:border-white/8 shadow-sm hover:border-[#2563EB]/50 hover:shadow-md dark:hover:border-white/12 transition-all cursor-pointer group"
    >
      <div className="flex flex-col gap-2">
        {post.city && (
          <span className="flex items-center gap-1 text-[11px] text-[#2563EB] dark:text-[#60A5FA] font-semibold w-fit">
            <MapPin size={10} />
            {post.city.cityName}
          </span>
        )}
        <h3 className="text-sm font-bold text-[#0f172a] dark:text-white/90 group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors line-clamp-1">
          {post.title}
        </h3>
        <p className="text-sm text-[#0f172a]/50 dark:text-white/40 line-clamp-2 leading-relaxed">
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
// 검색 입력 후 서버 요청까지의 디바운스 — resize처럼 연속 이벤트라 불가피
const SEARCH_DEBOUNCE_MS = 400;

export default function CommunityListClient({ initialPosts, initialCities }: Props) {
  const router = useRouter();
  const { show } = useSnackbar();
  const token = useAuthStore((s) => s.token);

  // SSR이 첫 페이지를 채워주므로 isLoading은 false로 시작 — 마운트 후 추가 fetch 없음
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts.data);
  const [total, setTotal] = useState(initialPosts.total);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPosts.page);
  const [hasMore, setHasMore] = useState(initialPosts.data.length < initialPosts.total);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cities] = useState<CityOption[]>(initialCities);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(
    async (params: { page?: number; keyword?: string; sort?: 'latest' | 'popular'; append?: boolean }) => {
      const { page = 1, keyword = searchQuery, sort: s = sort, append = false } = params;
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      try {
        const res = await nestApi.get<PagedCommunityResponse>('/community', {
          params: { page, limit: PAGE_LIMIT, ...(keyword && { keyword }), sort: s },
        });
        const newPosts = res.data.data;
        if (append) {
          setPosts((prev) => [...prev, ...newPosts]);
        } else {
          setPosts(newPosts);
        }
        setTotal(res.data.total);
        setCurrentPage(page);
        setHasMore(
          append
            ? posts.length + newPosts.length < res.data.total
            : newPosts.length < res.data.total,
        );
      } catch {
        show('게시글을 불러오지 못했습니다', 'error');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [searchQuery, sort, posts.length, show],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      // 키 입력이 연속으로 발생하므로 마지막 입력 후 요청 — 400ms는 사람이 인지 못하는 최소 지연
      debounceTimer.current = setTimeout(() => {
        setSearchQuery(value);
        setSelectedCity(null);
        void fetchPosts({ page: 1, keyword: value, sort });
      }, SEARCH_DEBOUNCE_MS);
    },
    [fetchPosts, sort],
  );

  const handleSortChange = useCallback(
    (newSort: 'latest' | 'popular') => {
      if (newSort === sort) return;
      setSort(newSort);
      void fetchPosts({ page: 1, keyword: searchQuery, sort: newSort });
    },
    [sort, fetchPosts, searchQuery],
  );

  // 글 작성 후 목록을 새로고침 — 검색·정렬 상태 초기화 없이 현재 조건으로 재조회
  const loadPosts = useCallback(() => {
    void fetchPosts({ page: 1 });
  }, [fetchPosts]);

  // sentinel div가 뷰포트에 진입하면 다음 페이지 자동 로드 (도시 칩 필터 중에는 비활성)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading && !isLoadingMore && selectedCity === null) {
          void fetchPosts({ page: currentPage + 1, append: true });
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, selectedCity, currentPage, fetchPosts]);

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

  // 도시 칩 필터는 로드된 데이터 내에서만 적용 — 서버 검색과 별개로 빠른 UX 제공
  const filteredPosts = useMemo(
    () => (selectedCity === null ? posts : posts.filter((p) => p.city?.cityName === selectedCity)),
    [posts, selectedCity],
  );

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
    <main className="min-h-screen bg-white dark:bg-[#1c1c1e]">
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

        <PublicPlanSlider title="공유된 여행 일정" />

        <div className="border-t border-[#DBEAFE]/50 dark:border-white/8" />

        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white/80">
              {searchQuery ? `"${searchQuery}" 검색 결과 · ${total}건` : '여행 이야기'}
            </h2>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#2c2c2e] rounded-xl p-1">
              <button
                type="button"
                onClick={() => handleSortChange('latest')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                  ${sort === 'latest'
                    ? 'bg-white dark:bg-[#3a3a3c] text-[#2563EB] dark:text-[#60A5FA] shadow-sm'
                    : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'
                  }`}
              >
                <Clock size={12} />
                최신순
              </button>
              <button
                type="button"
                onClick={() => handleSortChange('popular')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                  ${sort === 'popular'
                    ? 'bg-white dark:bg-[#3a3a3c] text-[#2563EB] dark:text-[#60A5FA] shadow-sm'
                    : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'
                  }`}
              >
                <TrendingUp size={12} />
                인기순
              </button>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="제목, 본문 또는 작성자 검색"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-2xl bg-white dark:bg-[#2c2c2e] border border-[#DBEAFE] dark:border-white/8 text-[#0f172a] dark:text-white/90 placeholder:text-[#0f172a]/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#2563EB]/30 dark:focus:ring-[#60A5FA]/20 focus:border-[#2563EB] transition-all"
            />
          </div>

          {cityChips.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedCity(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border
                  ${selectedCity === null
                    ? 'bg-[#2563EB] text-[#0f172a] border-[#2563EB] dark:bg-[#60A5FA] dark:border-[#60A5FA] dark:text-[#0f172a]'
                    : 'bg-white text-[#0f172a]/50 border-[#DBEAFE] hover:border-[#2563EB] dark:bg-[#2c2c2e] dark:text-white/40 dark:border-white/8 dark:hover:border-white/20'
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
                      ? 'bg-[#2563EB] text-[#0f172a] border-[#2563EB] dark:bg-[#60A5FA] dark:border-[#60A5FA] dark:text-[#0f172a]'
                      : 'bg-white text-[#0f172a]/50 border-[#DBEAFE] hover:border-[#2563EB] hover:text-[#2563EB] dark:bg-[#2c2c2e] dark:text-white/40 dark:border-white/8 dark:hover:border-[#60A5FA]/40 dark:hover:text-[#60A5FA]'
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
              <div className="lg:col-span-2 bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#2563EB]/20 dark:border-white/8 p-16 flex flex-col items-center gap-3 text-[#0f172a]/20 dark:text-white/20">
                <MessageSquare size={40} strokeWidth={1.5} />
                <span className="text-sm">
                  {searchInput ? '검색 결과가 없습니다' : '아직 게시글이 없습니다'}
                </span>
              </div>
            )}

            {!isLoading &&
              filteredPosts.map((post) => (
                <CommunityPostCard key={post.communityNum} post={post} onOpen={handlePostOpen} />
              ))}
          </div>

          {/* sentinel — 도시 칩 필터 중에는 숨김 (로드된 데이터 내 필터라 추가 로드 불필요) */}
          {selectedCity === null && (
            <div ref={sentinelRef} className="h-4" />
          )}
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-white/30">
                <div className="w-4 h-4 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
                불러오는 중...
              </div>
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
