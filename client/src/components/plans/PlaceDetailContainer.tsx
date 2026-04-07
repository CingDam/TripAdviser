"use client"
import { useState } from 'react'
import {
  ArrowLeft, Navigation, CalendarPlus,
  MapPin, Clock, Phone, Globe,
  Star, MessageCircle,
} from 'lucide-react'
import usePlanStore from '@/store/usePlanStore'
import { useSnackbar } from '@/components/common/SnackbarProvider'
import placeTypesJson from '@/constants/placeTypes.json'

// Record<string, ...> 캐스팅: JSON import는 키가 고정 리터럴로 추론돼서 string 인덱싱 불가 → as로 해결
const TYPE_LABEL = placeTypesJson as Record<string, { label: string; color: string }>;

function getTag(types: string[]): { label: string; color: string } | null {
  for (const t of types) {
    if (TYPE_LABEL[t]) return TYPE_LABEL[t];
  }
  return null;
}

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

// TODO: 리뷰 타입 — 나중에 서버 응답 타입과 맞출 것
interface Review {
  id: string;
  author: string;
  rating: number;
  content: string;
  createdAt: string;
}

const PlaceDetailContainer = () => {
  const detailPlace      = usePlanStore((s) => s.detailPlace);
  const setDetailPlace   = usePlanStore((s) => s.setDetailPlace);
  const setSelectedPlace = usePlanStore((s) => s.setSelectedPlace);
  const addPlaceToDayPlan = usePlanStore((s) => s.addPlaceToDayPlan);
  const selectedDate     = usePlanStore((s) => s.selectedDate);

  // 닫기 애니메이션: true이면 slide-out 실행 후 setDetailPlace(null)
  const { show } = useSnackbar();

  const [isClosing, setIsClosing] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // TODO: 실제 리뷰 데이터는 NestJS API 연결 후 교체
  // GET /reviews?place_id=xxx 로 불러올 예정
  const reviews: Review[] = [];

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

  const handleSubmitReview = () => {
    if (reviewRating === 0) { show('별점을 선택해주세요.', 'warning'); return; }
    if (!reviewText.trim()) { show('리뷰 내용을 입력해주세요.', 'warning'); return; }
    // TODO: POST /reviews { place_id, rating, content } 연결
    show('리뷰 기능은 준비 중입니다.', 'info');
  };

  return (
    // 슬라이드 진입/퇴장 애니메이션 — isClosing 여부에 따라 keyframe 전환
    <div
      className="absolute inset-0 bg-white/95 dark:bg-[#2c2c2e]/96 backdrop-blur-sm z-20 flex flex-col overflow-y-auto"
      style={{
        animation: isClosing
          ? 'slideOutToRight 0.25s ease-in forwards'
          : 'slideInFromRight 0.25s ease-out',
      }}
    >

      {/* ── 히어로 영역 */}
      <div className="relative w-full h-52 flex-shrink-0 bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
        <MapPin size={56} className="text-indigo-200 dark:text-indigo-400/30" strokeWidth={1} />

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
            {detailPlace.rating && (
              <>
                <span className="text-sm font-bold text-amber-300">{detailPlace.rating}</span>
                <div className="flex">
                  {[1,2,3,4,5].map((s) => (
                    <Star
                      key={s}
                      size={12}
                      strokeWidth={0}
                      className={s <= Math.round(detailPlace.rating!) ? 'text-amber-300 fill-amber-300' : 'text-white/30 fill-white/30'}
                    />
                  ))}
                </div>
                {detailPlace.user_ratings_total && (
                  <span className="text-xs text-white/70">({detailPlace.user_ratings_total.toLocaleString()})</span>
                )}
              </>
            )}
            {tag && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold backdrop-blur-sm"
                style={{ background: tag.color + '44', color: 'white', border: `1px solid ${tag.color}88` }}
              >
                {tag.label}
              </span>
            )}
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
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-indigo-500/10 group-hover:bg-gray-200 dark:group-hover:bg-indigo-500/20 flex items-center justify-center transition-colors shadow-sm">
            <Navigation size={20} className="text-gray-700 dark:text-indigo-400" />
          </div>
          <span className="text-xs text-gray-700 dark:text-indigo-400 font-medium">위치보기</span>
        </button>

        <button
          onClick={() => {
            if (!selectedDate) { show('날짜를 먼저 선택해주세요!', 'warning'); return; }
            addPlaceToDayPlan(selectedDate, detailPlace);
            handleClose();
          }}
          className="flex flex-col items-center gap-1.5 bg-transparent border-none cursor-pointer p-2 group"
        >
          <div className="w-12 h-12 rounded-full bg-gray-900 dark:bg-indigo-500/10 group-hover:bg-gray-700 dark:group-hover:bg-indigo-500/20 flex items-center justify-center transition-colors shadow-sm">
            <CalendarPlus size={20} className="text-white dark:text-indigo-400" />
          </div>
          <span className="text-xs text-gray-900 dark:text-indigo-400 font-medium">일정추가</span>
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
            <a href={`tel:${detailPlace.phone}`} className="text-sm text-blue-500 dark:text-blue-400 no-underline hover:underline">
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
              className="text-sm text-blue-500 dark:text-blue-400 no-underline hover:underline truncate block"
            >
              {detailPlace.website.replace(/^https?:\/\//, '')}
            </a>
          </InfoRow>
        )}
      </div>

      {/* ── 리뷰 섹션 ── */}
      <div className="h-2 bg-gray-50 dark:bg-white/4 my-3" />

      <div className="px-4 pb-8">
        <h3 className="text-base font-bold text-gray-800 dark:text-white/90 mb-4">방문자 리뷰</h3>

        {/* 리뷰 작성 폼 */}
        <div className="border border-gray-100 dark:border-white/8 rounded-2xl p-4 mb-5 flex flex-col gap-3 bg-gray-50/50 dark:bg-white/4">
          <p className="text-xs text-gray-500 dark:text-white/40 font-medium">이 장소를 다녀오셨나요?</p>
          <StarPicker value={reviewRating} onChange={setReviewRating} />
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="방문 후기를 남겨주세요."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl resize-none outline-none focus:border-indigo-300 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 transition-all bg-white dark:bg-white/5 text-gray-900 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/20"
          />
          <button
            onClick={handleSubmitReview}
            className="self-end px-4 py-1.5 bg-gray-900 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            등록
          </button>
        </div>

        {/* 리뷰 목록 */}
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-300 dark:text-white/20 flex flex-col items-center gap-2">
            <MessageCircle size={36} strokeWidth={1.5} />
            <p className="text-sm">아직 등록된 리뷰가 없습니다.</p>
            <p className="text-xs">첫 번째 리뷰를 남겨보세요!</p>
          </div>
        ) : (
          // TODO: NestJS API 연결 후 reviews 배열 채울 것
          reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-50 dark:border-white/6 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800 dark:text-white/90">{review.author}</span>
                <span className="text-xs text-gray-400 dark:text-white/30">{review.createdAt}</span>
              </div>
              <div className="flex">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={12} strokeWidth={0}
                    className={s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-white/10 fill-gray-200 dark:fill-white/10'}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">{review.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlaceDetailContainer;
