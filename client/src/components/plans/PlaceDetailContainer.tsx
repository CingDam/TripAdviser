"use client"
import { useState } from 'react'
import Image from 'next/image'
import usePlanStore from '@/store/usePlanStore'
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
const InfoRow = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div className="flex gap-4 items-start py-3 border-b border-gray-50">
    <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

// 별점 선택 컴포넌트
const StarPicker = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <span
        key={star}
        onClick={() => onChange(star)}
        className={`text-2xl cursor-pointer transition-colors ${star <= value ? 'text-amber-400' : 'text-gray-200'}`}
      >
        ★
      </span>
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
  const detailPlace    = usePlanStore((s) => s.detailPlace);
  const setDetailPlace = usePlanStore((s) => s.setDetailPlace);
  const setSelectedPlace = usePlanStore((s) => s.setSelectedPlace);
  const addPlaceToDayPlan = usePlanStore((s) => s.addPlaceToDayPlan);
  const selectedDate   = usePlanStore((s) => s.selectedDate);

  // 닫기 애니메이션: true이면 slide-out 실행 후 setDetailPlace(null)
  const [isClosing, setIsClosing] = useState(false);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // TODO: 실제 리뷰 데이터는 NestJS API 연결 후 교체
  // GET /reviews?place_id=xxx 로 불러올 예정
  const reviews: Review[] = [];

  if (!detailPlace) return null;

  const tag = getTag(detailPlace.types ?? []);

  // 애니메이션이 끝난 뒤 패널을 닫는 핸들러
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setDetailPlace(null);
    }, 250);
  };

  const handleSubmitReview = () => {
    if (reviewRating === 0) { alert('별점을 선택해주세요.'); return; }
    if (!reviewText.trim()) { alert('리뷰 내용을 입력해주세요.'); return; }
    // TODO: POST /reviews { place_id, rating, content } 연결
    alert('리뷰 기능은 준비 중입니다.');
  };

  return (
    // 슬라이드 진입/퇴장 애니메이션 — isClosing 여부에 따라 keyframe 전환
    <div
      className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col overflow-y-auto"
      style={{
        animation: isClosing
          ? 'slideOutToRight 0.25s ease-in forwards'
          : 'slideInFromRight 0.25s ease-out',
      }}
    >

      {/* ── 히어로 이미지 ── */}
      {/* relative 필수 — Image fill 모드는 가장 가까운 relative 부모 기준으로 채움 */}
      <div className="relative w-full h-52 flex-shrink-0 bg-gray-100">
        {detailPlace.photoUrl
          ? <Image unoptimized fill src={detailPlace.photoUrl} alt={detailPlace.name} className="object-cover" sizes="100vw" />
          : <div className="w-full h-full flex items-center justify-center text-5xl">📍</div>
        }

        {/* 히어로 그라디언트 오버레이 — 하단 텍스트 가독성 + glassmorphism 느낌 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* 뒤로가기 버튼 — backdrop-blur로 glass 효과 */}
        <button
          onClick={handleClose}
          className="absolute top-3 left-3 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition-all cursor-pointer"
        >
          ←
        </button>

        {/* 히어로 하단 장소명 오버레이 — 이미지 위에 이름 표시 */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6">
          <h2 className="text-xl font-bold text-white drop-shadow-sm">{detailPlace.name}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {detailPlace.rating && (
              <>
                <span className="text-sm font-bold text-amber-300">{detailPlace.rating}</span>
                <span className="text-sm text-amber-300">
                  {'★'.repeat(Math.round(detailPlace.rating))}{'☆'.repeat(5 - Math.round(detailPlace.rating))}
                </span>
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
        {[
          {
            icon: '📌', label: '위치보기',
            // setSelectedPlace → MapContainer AdvancedMarker + panTo 트리거
            onClick: () => setSelectedPlace(detailPlace),
          },
          {
            icon: '➕', label: '일정추가',
            onClick: () => {
              if (!selectedDate) { alert('날짜를 먼저 선택해주세요!'); return; }
              addPlaceToDayPlan(selectedDate, detailPlace);
              handleClose();
            },
          },
        ].map(({ icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex flex-col items-center gap-1.5 bg-transparent border-none cursor-pointer p-2 group"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-xl transition-colors shadow-sm">
              {icon}
            </div>
            <span className="text-xs text-indigo-600 font-medium">{label}</span>
          </button>
        ))}
      </div>

      <div className="h-2 bg-gray-50 my-1" />

      {/* ── 상세 정보 ── */}
      <div className="px-4">
        <InfoRow icon="📍">
          <span className="text-sm text-gray-700">{detailPlace.formatted_address}</span>
        </InfoRow>

        {detailPlace.weekdayDescriptions && detailPlace.weekdayDescriptions.length > 0 && (
          <InfoRow icon="🕐">
            <div>
              {detailPlace.openNow != null && (
                <span className={`text-xs font-bold mb-1 block ${detailPlace.openNow ? 'text-green-600' : 'text-red-500'}`}>
                  {detailPlace.openNow ? '영업 중' : '영업 종료'}
                </span>
              )}
              {detailPlace.weekdayDescriptions.map((desc) => (
                <div key={desc} className="text-xs text-gray-500 leading-relaxed">{desc}</div>
              ))}
            </div>
          </InfoRow>
        )}

        {detailPlace.phone && (
          <InfoRow icon="📞">
            <a href={`tel:${detailPlace.phone}`} className="text-sm text-blue-500 no-underline hover:underline">
              {detailPlace.phone}
            </a>
          </InfoRow>
        )}

        {detailPlace.website && (
          <InfoRow icon="🌐">
            <a
              href={detailPlace.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 no-underline hover:underline truncate block"
            >
              {detailPlace.website.replace(/^https?:\/\//, '')}
            </a>
          </InfoRow>
        )}
      </div>

      {/* ── 리뷰 섹션 ── */}
      <div className="h-2 bg-gray-50 my-3" />

      <div className="px-4 pb-8">
        <h3 className="text-base font-bold text-gray-800 mb-4">방문자 리뷰</h3>

        {/* 리뷰 작성 폼 */}
        <div className="border border-gray-100 rounded-2xl p-4 mb-5 flex flex-col gap-3 bg-gray-50/50">
          <p className="text-xs text-gray-500 font-medium">이 장소를 다녀오셨나요?</p>
          <StarPicker value={reviewRating} onChange={setReviewRating} />
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="방문 후기를 남겨주세요."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all bg-white"
          />
          <button
            onClick={handleSubmitReview}
            className="self-end px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            등록
          </button>
        </div>

        {/* 리뷰 목록 */}
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-300">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm">아직 등록된 리뷰가 없습니다.</p>
            <p className="text-xs mt-1">첫 번째 리뷰를 남겨보세요!</p>
          </div>
        ) : (
          // TODO: NestJS API 연결 후 reviews 배열 채울 것
          reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-50 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">{review.author}</span>
                <span className="text-xs text-gray-400">{review.createdAt}</span>
              </div>
              <span className="text-xs text-amber-400">
                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
              </span>
              <p className="text-sm text-gray-600 leading-relaxed">{review.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlaceDetailContainer;
