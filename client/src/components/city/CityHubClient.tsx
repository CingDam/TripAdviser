'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  ArrowLeft,
  Cloud,
  Eye,
  Heart,
  ImagePlus,
  MapPin,
  MessageSquare,
  PenSquare,
  Star,
  X,
} from 'lucide-react';
import { nestApi } from '@/config/api.config';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import Button from '@/components/common/Button';

// ── 인터페이스 ─────────────────────────────────────────────────────────────

interface CityDetail {
  cityNum: number;
  cityName: string;
  country: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
  planCount: number;
}

interface WeatherDay {
  date: string;
  max: number;
  min: number;
  weatherCode: number;
}

interface Attraction {
  name: string;
  rating: number | undefined;
  photo: string | undefined;
  vicinity: string;
}

interface CommunityPost {
  communityNum: number;
  title: string;
  content: string;
  viewCount: number;
  createdAt: string;
  user: { userNum: number; name: string };
}

interface PostRow extends CommunityPost {
  likeCount: number;
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weathercode: number[];
  };
}

// ── 헬퍼 ───────────────────────────────────────────────────────────────────

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getWeatherInfo(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: '맑음', emoji: '☀️' };
  if (code === 1) return { label: '대체로 맑음', emoji: '🌤️' };
  if (code === 2) return { label: '구름 조금', emoji: '⛅' };
  if (code === 3) return { label: '흐림', emoji: '☁️' };
  if (code <= 48) return { label: '안개', emoji: '🌫️' };
  if (code <= 55) return { label: '이슬비', emoji: '🌦️' };
  if (code <= 65) return { label: '비', emoji: '🌧️' };
  if (code <= 77) return { label: '눈', emoji: '❄️' };
  if (code <= 82) return { label: '소나기', emoji: '🌦️' };
  if (code <= 86) return { label: '눈 소나기', emoji: '🌨️' };
  return { label: '뇌우', emoji: '⛈️' };
}

function formatDayLabel(dateStr: string, index: number): string {
  if (index === 0) return '오늘';
  if (index === 1) return '내일';
  return DAYS[new Date(dateStr).getDay()] + '요일';
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

// ── 날씨 카드 ───────────────────────────────────────────────────────────────

function WeatherCard({ weather }: { weather: WeatherDay[] }) {
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-5 border border-gray-100 dark:border-white/8 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white/90 mb-4 flex items-center gap-2">
        <Cloud size={15} className="text-indigo-400" />
        이번 주 날씨
      </h3>
      <div className="flex flex-col gap-1">
        {weather.map((day, i) => {
          const { label, emoji } = getWeatherInfo(day.weatherCode);
          return (
            <div
              key={day.date}
              className={`flex items-center justify-between py-2 ${
                i < weather.length - 1 ? 'border-b border-gray-50 dark:border-white/5' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-medium text-gray-500 dark:text-white/40 w-14 flex-shrink-0">
                  {formatDayLabel(day.date, i)}
                </span>
                <span className="text-base leading-none">{emoji}</span>
                <span className="text-xs text-gray-400 dark:text-white/30 truncate">{label}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white/90">{day.max}°</span>
                <span className="text-xs text-gray-400 dark:text-white/25">/ {day.min}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 관광지 카드 ─────────────────────────────────────────────────────────────

function AttractionsCard({ attractions }: { attractions: Attraction[] }) {
  if (attractions.length === 0) return null;
  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-5 border border-gray-100 dark:border-white/8 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white/90 mb-4 flex items-center gap-2">
        <MapPin size={15} className="text-indigo-400" />
        추천 관광지
      </h3>
      <div className="flex flex-col gap-3">
        {attractions.map((place, i) => (
          <div
            key={i}
            className={`flex gap-3 items-start ${
              i < attractions.length - 1 ? 'pb-3 border-b border-gray-50 dark:border-white/5' : ''
            }`}
          >
            {place.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={place.photo}
                alt={place.name}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100 dark:border-white/8"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-white/5 flex-shrink-0 flex items-center justify-center">
                <MapPin size={16} className="text-gray-300 dark:text-white/20" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-800 dark:text-white/80 line-clamp-1">
                {place.name}
              </p>
              {place.rating !== undefined && (
                <p className="text-xs text-amber-500 flex items-center gap-0.5 mt-0.5">
                  <Star size={10} className="fill-current" />
                  {place.rating.toFixed(1)}
                </p>
              )}
              {place.vicinity && (
                <p className="text-[11px] text-gray-400 dark:text-white/25 line-clamp-1 mt-0.5">
                  {place.vicinity}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 스켈레톤 ───────────────────────────────────────────────────────────────

const SkeletonPost = () => (
  <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 border border-gray-100 dark:border-white/8 flex flex-col gap-3">
    <div className="skeleton h-4 w-2/3 rounded-full" />
    <div className="skeleton h-3 w-full rounded-full" />
    <div className="skeleton h-3 w-1/2 rounded-full" />
    <div className="flex gap-3 mt-1">
      <div className="skeleton h-3 w-16 rounded-full" />
      <div className="skeleton h-3 w-16 rounded-full" />
    </div>
  </div>
);

// ── 내부 컨텐츠 (APIProvider 안에서 useMapsLibrary 사용) ───────────────────

function CityHubContent({ cityNum }: { cityNum: number }) {
  const router = useRouter();
  const { show } = useSnackbar();
  const { token } = useAuthStore();
  const placesLib = useMapsLibrary('places');
  // PlacesService는 HTMLDivElement를 attribution 컨테이너로 요구 — 숨겨진 div 사용
  const attractionsDivRef = useRef<HTMLDivElement>(null);

  const [city, setCity] = useState<CityDetail | null>(null);
  const [weather, setWeather] = useState<WeatherDay[] | null>(null);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [isCityLoading, setIsCityLoading] = useState(true);

  // 글쓰기 모달
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [modalImages, setModalImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 도시 정보 + 날씨 로드
  useEffect(() => {
    void (async () => {
      try {
        const cityRes = await nestApi.get<CityDetail>(`/city/${cityNum}`);
        setCity(cityRes.data);

        // Open-Meteo — API 키 불필요, 완전 무료
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${cityRes.data.lat}&longitude=${cityRes.data.lng}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`,
        );
        const wData = (await wRes.json()) as OpenMeteoResponse;
        setWeather(
          wData.daily.time.map((date, i) => ({
            date,
            max: Math.round(wData.daily.temperature_2m_max[i]),
            min: Math.round(wData.daily.temperature_2m_min[i]),
            weatherCode: wData.daily.weathercode[i],
          })),
        );
      } catch {
        show('도시 정보를 불러오지 못했습니다', 'error');
      } finally {
        setIsCityLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityNum]);

  // 도시가 확정되면 커뮤니티 게시글 로드
  useEffect(() => {
    if (!city) return;
    void loadPosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // Google Places — 주변 관광지 검색
  useEffect(() => {
    if (!placesLib || !city || !attractionsDivRef.current) return;
    const service = new placesLib.PlacesService(attractionsDivRef.current);
    service.nearbySearch(
      { location: { lat: city.lat, lng: city.lng }, radius: 8000, type: 'tourist_attraction' },
      (results, status) => {
        if (status === placesLib.PlacesServiceStatus.OK && results) {
          setAttractions(
            results.slice(0, 6).map((r) => ({
              name: r.name ?? '',
              rating: r.rating,
              photo: r.photos?.[0]?.getUrl({ maxWidth: 300 }),
              vicinity: r.vicinity ?? '',
            })),
          );
        }
      },
    );
  }, [placesLib, city]);

  const loadPosts = async () => {
    if (!city) return;
    setIsPostsLoading(true);
    try {
      const res = await nestApi.get<CommunityPost[]>(`/community?cityNum=${city.cityNum}`);
      const rows = await Promise.all(
        res.data.map(async (post) => {
          try {
            const likeRes = await nestApi.get<{ count: number }>(`/community/${post.communityNum}/like`);
            return { ...post, likeCount: likeRes.data.count };
          } catch {
            return { ...post, likeCount: 0 };
          }
        }),
      );
      setPosts(rows);
    } catch {
      show('게시글을 불러오지 못했습니다', 'error');
    } finally {
      setIsPostsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!modalTitle.trim() || !modalContent.trim()) {
      show('제목과 내용을 입력해주세요', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await nestApi.post<{ communityNum: number }>('/community', {
        title: modalTitle.trim(),
        content: modalContent.trim(),
        cityNum: city!.cityNum,
      });
      if (modalImages.length > 0) {
        const form = new FormData();
        modalImages.forEach((file) => form.append('images', file));
        await nestApi.post(`/community/${res.data.communityNum}/images`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      show('게시글이 등록되었습니다', 'success');
      closeModal();
      void loadPosts();
    } catch {
      show('등록에 실패했습니다', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalTitle('');
    setModalContent('');
    setModalImages([]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setModalImages((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = '';
  };

  // ── 로딩 스켈레톤 ────────────────────────────────────────────────────────

  if (isCityLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e]">
        <div className="skeleton h-72 w-full" />
        <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="skeleton h-6 w-32 rounded-xl" />
            <SkeletonPost />
            <SkeletonPost />
            <SkeletonPost />
          </div>
          <div className="flex flex-col gap-6">
            <div className="skeleton h-64 w-full rounded-3xl" />
            <div className="skeleton h-72 w-full rounded-3xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!city) return null;

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#1c1c1e]">
      {/* PlacesService attribution용 숨겨진 div */}
      <div ref={attractionsDivRef} className="hidden" />

      {/* 히어로 배너 */}
      <div className="relative h-72 w-full overflow-hidden">
        {city.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={city.imageUrl} alt={city.cityName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* 뒤로가기 */}
        <button
          onClick={() => router.push('/community')}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full cursor-pointer"
        >
          <ArrowLeft size={13} />
          커뮤니티
        </button>

        {/* 도시 정보 */}
        <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-6 pb-8">
          <p className="text-white/60 text-sm flex items-center gap-1 mb-1">
            <MapPin size={12} />
            {city.country}
          </p>
          <h1 className="text-4xl font-bold text-white tracking-tight">{city.cityName}</h1>
          <p className="text-white/50 text-sm mt-1.5">{city.planCount.toLocaleString()}개의 여행 일정</p>
        </div>
      </div>

      {/* 본문 — 2/3 + 1/3 그리드 */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-8 items-start">

        {/* 왼쪽: 커뮤니티 게시글 */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white/90 flex items-center gap-2">
              여행 이야기
              {posts.length > 0 && (
                <span className="text-sm font-normal text-gray-400 dark:text-white/30">{posts.length}</span>
              )}
            </h2>
            {token && (
              <Button variant="primary" onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5">
                <PenSquare size={13} />
                글쓰기
              </Button>
            )}
          </div>

          {isPostsLoading && (
            <>
              <SkeletonPost />
              <SkeletonPost />
              <SkeletonPost />
            </>
          )}

          {!isPostsLoading && posts.length === 0 && (
            <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-16 flex flex-col items-center gap-3 text-gray-300 dark:text-white/20 border border-gray-100 dark:border-white/8">
              <MessageSquare size={40} strokeWidth={1.5} />
              <p className="text-sm text-center">
                {city.cityName}에 대한 첫 번째 이야기를 남겨보세요
              </p>
              {token && (
                <Button variant="primary" onClick={() => setIsModalOpen(true)} className="mt-2 flex items-center gap-1.5">
                  <PenSquare size={13} />
                  글쓰기
                </Button>
              )}
            </div>
          )}

          {posts.map((post) => (
            <div
              key={post.communityNum}
              onClick={() => router.push(`/community/${post.communityNum}`)}
              className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-5 border border-gray-100 dark:border-white/8 shadow-sm hover:shadow-md dark:hover:border-white/12 transition-all cursor-pointer group"
            >
              <div className="flex flex-col gap-2">
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
          ))}
        </div>

        {/* 오른쪽: 사이드바 (스크롤 시 고정) */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          {/* 날씨 스켈레톤 — 로드 전 */}
          {!weather && (
            <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-5 border border-gray-100 dark:border-white/8">
              <div className="skeleton h-4 w-28 rounded-full mb-4" />
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="skeleton h-8 w-full rounded-xl mb-2" />
              ))}
            </div>
          )}
          {weather && <WeatherCard weather={weather} />}

          {/* 관광지 스켈레톤 — Places API 로드 전 */}
          {attractions.length === 0 && placesLib === null && (
            <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-5 border border-gray-100 dark:border-white/8">
              <div className="skeleton h-4 w-28 rounded-full mb-4" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 w-full rounded-xl mb-3" />
              ))}
            </div>
          )}
          <AttractionsCard attractions={attractions} />
        </div>
      </div>

      {/* 글쓰기 모달 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-[#2c2c2e] rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white/90">새 글 작성</h2>
                {/* 현재 도시가 자동 선택됨을 표시 */}
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 flex items-center gap-1">
                  <MapPin size={10} />
                  {city.cityName}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-white/30 dark:hover:text-white/70 dark:hover:bg-white/8 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-white/40">제목</label>
              <input
                type="text"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                maxLength={100}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-white/40">내용</label>
              <textarea
                value={modalContent}
                onChange={(e) => setModalContent(e.target.value)}
                placeholder="여행 이야기를 자유롭게 작성해보세요"
                rows={6}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all resize-none leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-white/40">
                이미지 <span className="font-normal text-gray-400 dark:text-white/25">(선택 · 최대 5장)</span>
              </label>
              {modalImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {modalImages.map((file, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 dark:border-white/8 group flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setModalImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {modalImages.length < 5 && (
                <label className="flex items-center gap-2 w-fit px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-white/15 text-xs text-gray-500 dark:text-white/35 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400 transition-all cursor-pointer">
                  <ImagePlus size={14} />
                  사진 추가
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>취소</Button>
              <Button variant="primary" onClick={() => void handleSubmit()} disabled={isSubmitting}>
                {isSubmitting ? '등록 중...' : '등록'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── 외부 export — APIProvider 래핑 ──────────────────────────────────────────

export default function CityHubClient({ cityNum }: { cityNum: number }) {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <CityHubContent cityNum={cityNum} />
    </APIProvider>
  );
}
