"use client"
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import {
  ArrowLeft, Navigation, CalendarPlus,
  MapPin, Clock, Phone, Globe,
  Star, MessageCircle, Trash2, Heart,
} from 'lucide-react'
import usePlanStore from '@/store/usePlanStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useSnackbar } from '@/components/common/SnackbarProvider'
import { getTag, getPriceLabel } from '@/utils/placeUtils'
import { nestApi } from '@/config/api.config'
import Button from '@/components/common/Button'

// 구글맵 스타일 정보 행 — 아이콘 + 내용 가로 배치, 하단 구분선 포함
const InfoRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex gap-4 items-start py-3 border-b border-gray-50 dark:border-white/6">
    <span className="flex-shrink-0 mt-0.5 text-gray-400 dark:text-white/30">{icon}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

// 별점 선택 컴포넌트
const StarPicker = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        size={24}
        onClick={() => onChange(star)}
        className={`cursor-pointer transition-colors ${star <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-white/15 fill-gray-200 dark:fill-white/10'}`}
        strokeWidth={0}
      />
    ))}
  </div>
);

interface Review {
  reviewNum: number;
  user: { userNum: number; name: string };
  rating: number;
  content: string | null;
  createdAt: string;
  likeCount: number;
  isLiked: boolean;
}

const PlaceDetailContainer = () => {
  const detailPlace      = usePlanStore((s) => s.detailPlace);
  const setDetailPlace   = usePlanStore((s) => s.setDetailPlace);
  const setSelectedPlace = usePlanStore((s) => s.setSelectedPlace);
  const addPlaceToDayPlan = usePlanStore((s) => s.addPlaceToDayPlan);
  const selectedDate     = usePlanStore((s) => s.selectedDate);
  const currentCityNum   = usePlanStore((s) => s.currentCityNum);

  const { show } = useSnackbar();
  const { userNum, token } = useAuthStore();

  const [isClosing, setIsClosing] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const pid = detailPlace?.place_id ?? null;

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', pid],
    queryFn: () => nestApi.get<Review[]>(`/review?placeId=${pid}`).then((r) => r.data),
    enabled: !!pid,
  });

  const { data: stats = null } = useQuery({
    queryKey: ['review-stats', pid],
    queryFn: () =>
      nestApi.get<{ avgRating: number; count: number }>(`/review/stats?placeId=${pid}`).then((r) => r.data),
    enabled: !!pid,
  });

  if (!detailPlace) return null;

  const tag = getTag(detailPlace.types ?? []);

  // 닫기 애니메이션(250ms) 완료 후 상태를 제거하는 핸들러
  // onAnimationEnd 대신 setTimeout 사용 — CSS keyframe 종료 이벤트가 없는 Tailwind 유틸리티 클래스이므로 불가피
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setDetailPlace(null);
    }, 250);
  };

  const updateReviewCache = (updated: Review[]) => {
    queryClient.setQueryData(['reviews', pid], updated);
    const avg = updated.length > 0
      ? updated.reduce((s, r) => s + r.rating, 0) / updated.length
      : 0;
    queryClient.setQueryData(['review-stats', pid], {
      avgRating: Math.round(avg * 10) / 10,
      count: updated.length,
    });
  };

  const handleSubmitReview = async () => {
    if (!token) { show('로그인 후 리뷰를 남길 수 있습니다', 'warning'); return; }
    if (reviewRating === 0) { show('별점을 선택해주세요', 'warning'); return; }
    if (!reviewText.trim()) { show('리뷰 내용을 입력해주세요', 'warning'); return; }
    setIsSubmitting(true);
    try {
      const res = await nestApi.post<Review>('/review', {
        placeId: detailPlace?.place_id,
        locationName: detailPlace?.name,
        rating: reviewRating,
        content: reviewText.trim(),
        ...(currentCityNum && { cityNum: currentCityNum }),
      });
      updateReviewCache([res.data, ...reviews]);
      setReviewRating(0);
      setReviewText('');
      show('리뷰가 등록됐습니다', 'success');
    } catch {
      show('등록에 실패했습니다', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewNum: number) => {
    try {
      await nestApi.delete(`/review/${reviewNum}`);
      updateReviewCache(reviews.filter((r) => r.reviewNum !== reviewNum));
      show('리뷰가 삭제됐습니다', 'info');
    } catch {
      show('삭제에 실패했습니다', 'error');
    }
  };

  const handleToggleLike = async (reviewNum: number) => {
    if (!token) { show('로그인 후 좋아요를 누를 수 있습니다', 'warning'); return; }
    try {
      const res = await nestApi.post<{ liked: boolean; likeCount: number }>(`/review/${reviewNum}/like`);
      queryClient.setQueryData(
        ['reviews', pid],
        reviews.map((r) =>
          r.reviewNum === reviewNum
            ? { ...r, isLiked: res.data.liked, likeCount: res.data.likeCount }
            : r,
        ),
      );
    } catch {
      show('좋아요 처리에 실패했습니다', 'error');
    }
  };

  return (
    // 슬라이드 진입/퇴장 애니메이션 — isClosing 여부에 따라 keyframe 전환
    <div
      className="absolute inset-0 bg-white/95 dark:bg-[#2c2c2e]/96 backdrop-blur-sm z-20 flex flex-col overflow-y-auto"
      style={{
        animation: isClosing
          ? 'slideOutToLeft 0.25s cubic-bezier(0.4, 0, 1, 1) forwards'
          : 'slideInFromLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >

      {/* ── 히어로 영역 */}
      <div
        className="relative w-full h-52 flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: tag ? tag.color + '18' : '#EFF6FF' }}
      >
        {detailPlace.photoUrl ? (
          <Image
            src={detailPlace.photoUrl}
            alt={detailPlace.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 360px"
            unoptimized
          />
        ) : (
          (() => {
            const HeroIcon = tag?.Icon ?? MapPin;
            return (
              <HeroIcon
                size={64}
                strokeWidth={1.5}
                style={{
                  color: tag ? tag.color : '#93C5FD',
                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))',
                }}
              />
            );
          })()
        )}

        {/* 그라디언트 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

        {/* 뒤로가기 버튼 */}
        <button
          onClick={handleClose}
          className="absolute top-3 left-3 w-9 h-9 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center text-gray-700 dark:text-white/80 hover:bg-white dark:hover:bg-black/70 transition-all cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>

        {/* 히어로 하단 장소명 */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6">
          <h2 className="text-xl font-bold text-white drop-shadow-sm">{detailPlace.name}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {/* 우리 리뷰가 있으면 우리 평점, 없으면 구글 평점으로 폴백 */}
            {(stats && stats.count > 0) ? (
              <>
                <span className="text-sm font-bold text-amber-300">{stats.avgRating}</span>
                <div className="flex">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={12} strokeWidth={0}
                      className={s <= Math.round(stats.avgRating) ? 'text-amber-300 fill-amber-300' : 'text-white/30 fill-white/30'}
                    />
                  ))}
                </div>
                <span className="text-xs text-white/70">({stats.count})</span>
              </>
            ) : detailPlace.rating ? (
              <>
                <span className="text-sm font-bold text-amber-300">{detailPlace.rating}</span>
                <div className="flex">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={12} strokeWidth={0}
                      className={s <= Math.round(detailPlace.rating!) ? 'text-amber-300 fill-amber-300' : 'text-white/30 fill-white/30'}
                    />
                  ))}
                </div>
                {detailPlace.user_ratings_total && (
                  <span className="text-xs text-white/70">({detailPlace.user_ratings_total.toLocaleString()})</span>
                )}
              </>
            ) : null}
            {tag && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold backdrop-blur-sm"
                style={{ background: tag.color + '44', color: 'white', border: `1px solid ${tag.color}88` }}
              >
                {tag.label}
              </span>
            )}
            {(() => {
              const price = getPriceLabel(detailPlace.priceLevel);
              return price ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-black/30 backdrop-blur-sm text-white/90">
                  {price}
                </span>
              ) : null;
            })()}
          </div>
        </div>
      </div>

      {/* ── 액션 버튼 ── */}
      <div className="flex justify-around px-4 py-4">
        <button
          onClick={() => setSelectedPlace(detailPlace)}
          className="flex flex-col items-center gap-1.5 bg-transparent border-none cursor-pointer p-2 group"
        >
          {/* setSelectedPlace → MapContainer AdvancedMarker + panTo 트리거 */}
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/8 group-hover:bg-gray-200 dark:group-hover:bg-white/12 flex items-center justify-center transition-colors shadow-sm">
            <Navigation size={20} className="text-gray-700 dark:text-white/60" />
          </div>
          <span className="text-xs text-gray-700 dark:text-white/60 font-medium">위치보기</span>
        </button>

        <button
          onClick={() => {
            if (!selectedDate) { show('날짜를 먼저 선택해주세요!', 'warning'); return; }
            addPlaceToDayPlan(selectedDate, detailPlace);
            handleClose();
          }}
          className="flex flex-col items-center gap-1.5 bg-transparent border-none cursor-pointer p-2 group"
        >
          <div className="w-12 h-12 rounded-full bg-gray-900 dark:bg-[#2563EB] group-hover:bg-gray-700 dark:group-hover:bg-[#1D4ED8] flex items-center justify-center transition-colors shadow-sm">
            <CalendarPlus size={20} className="text-white" />
          </div>
          <span className="text-xs text-gray-900 dark:text-white/70 font-medium">일정추가</span>
        </button>
      </div>

      <div className="h-2 bg-gray-50 dark:bg-white/4 my-1" />

      {/* ── 상세 정보 ── */}
      <div className="px-4">
        <InfoRow icon={<MapPin size={18} />}>
          <span className="text-sm text-gray-700 dark:text-white/70">{detailPlace.formatted_address}</span>
        </InfoRow>

        {detailPlace.weekdayDescriptions && detailPlace.weekdayDescriptions.length > 0 && (
          <InfoRow icon={<Clock size={18} />}>
            <div>
              {detailPlace.openNow != null && (
                <span className={`text-xs font-bold mb-1 block ${detailPlace.openNow ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {detailPlace.openNow ? '영업 중' : '영업 종료'}
                </span>
              )}
              {detailPlace.weekdayDescriptions.map((desc) => (
                <div key={desc} className="text-xs text-gray-500 dark:text-white/40 leading-relaxed">{desc}</div>
              ))}
            </div>
          </InfoRow>
        )}

        {detailPlace.phone && (
          <InfoRow icon={<Phone size={18} />}>
            <a href={`tel:${detailPlace.phone}`} className="text-sm text-[#2563EB] dark:text-[#60A5FA] no-underline hover:underline">
              {detailPlace.phone}
            </a>
          </InfoRow>
        )}

        {detailPlace.website && (
          <InfoRow icon={<Globe size={18} />}>
            <a
              href={detailPlace.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 dark:text-rose-400 no-underline hover:underline truncate block"
            >
              {detailPlace.website.replace(/^https?:\/\//, '')}
            </a>
          </InfoRow>
        )}
      </div>

      {/* ── 리뷰 섹션 ── */}
      <div className="h-2 bg-gray-50 dark:bg-white/4 my-3" />

      <div className="px-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-800 dark:text-white/90">방문자 리뷰</h3>
          {stats && stats.count > 0 && (
            <span className="text-xs text-gray-400 dark:text-white/30">{stats.count}개</span>
          )}
        </div>

        {/* 리뷰 작성 폼 */}
        <div className="border border-gray-100 dark:border-white/8 rounded-2xl p-4 mb-5 flex flex-col gap-3 bg-gray-50/50 dark:bg-white/4">
          <p className="text-xs text-gray-500 dark:text-white/40 font-medium">이 장소를 다녀오셨나요?</p>
          <StarPicker value={reviewRating} onChange={setReviewRating} />
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="방문 후기를 남겨주세요."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl resize-none outline-none focus:border-[#2563EB] dark:focus:border-[#3B82F6]/60 focus:ring-2 focus:ring-[#DBEAFE]/60 dark:focus:ring-[#3B82F6]/20 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/20"
          />
          <Button variant="primary" size="sm" onClick={() => void handleSubmitReview()} disabled={isSubmitting} className="self-end">
            {isSubmitting ? '등록 중...' : '등록'}
          </Button>
        </div>

        {/* 리뷰 목록 */}
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-300 dark:text-white/20 flex flex-col items-center gap-2">
            <MessageCircle size={36} strokeWidth={1.5} />
            <p className="text-sm">아직 등록된 리뷰가 없습니다.</p>
            <p className="text-xs">첫 번째 리뷰를 남겨보세요!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.reviewNum} className="border-b border-gray-50 dark:border-white/6 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800 dark:text-white/90">{review.user.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-white/30">
                    {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                  {/* 좋아요 버튼 */}
                  <button
                    type="button"
                    onClick={() => void handleToggleLike(review.reviewNum)}
                    className="flex items-center gap-0.5 cursor-pointer transition-colors group"
                  >
                    <Heart
                      size={13}
                      strokeWidth={review.isLiked ? 0 : 1.5}
                      className={review.isLiked ? 'text-rose-500 fill-rose-500' : 'text-gray-300 dark:text-white/20 group-hover:text-rose-400'}
                    />
                    {review.likeCount > 0 && (
                      <span className={`text-xs ${review.isLiked ? 'text-rose-500' : 'text-gray-300 dark:text-white/20'}`}>
                        {review.likeCount}
                      </span>
                    )}
                  </button>
                  {/* 본인 리뷰만 삭제 버튼 표시 */}
                  {userNum === review.user.userNum && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteReview(review.reviewNum)}
                      className="text-gray-300 dark:text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={12} strokeWidth={0}
                    className={s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-white/10 fill-gray-200 dark:fill-white/10'}
                  />
                ))}
              </div>
              {review.content && (
                <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">{review.content}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlaceDetailContainer;
