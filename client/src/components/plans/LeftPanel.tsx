'use client';
import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import usePlanStore from '@/store/usePlanStore';
import Calendar from './Calender';
import TripSetupModal from './TripSetupModal';
import SearchContainer from './SearchContainer';
import AiChatPanel from './AiChatPanel';

type LeftTab = 'ai' | 'search';

interface Props {
  initialQuery: string | null;
  city: string | null;
  // 수정 모드 — 장소가 비동기로 곧 채워지므로 처음부터 검색 탭으로 시작
  isEdit: boolean;
  // md 이상 여부 — 모바일은 하단 탭바에 AI 인스턴스가 따로 있어
  // 좌측 패널 AI 탭을 마운트하면 대화 sessionStorage 이중 기록이 생긴다
  isDesktop: boolean;
}

const LeftPanel = ({ initialQuery, city, isEdit, isDesktop }: Props) => {
  const [showTripSetup, setShowTripSetup] = useState(false);
  const calendarResetKey = usePlanStore((s) => s.calendarResetKey);
  const tripConfig       = usePlanStore((s) => s.tripConfig);
  const aiBusy           = usePlanStore((s) => s.aiBusy);

  // 초기 탭 — 일정이 비어있으면 AI(자동생성 유도), 채워져 있으면 검색(다듬기).
  // 세션 도중 자동 전환은 하지 않는다 — 사용자가 보던 탭을 뺏지 않기 위해
  const [tab, setTab] = useState<LeftTab>(() => {
    const hasPlaces = usePlanStore.getState().dayPlans.some((d) => d.places.length > 0);
    return isEdit || hasPlaces ? 'search' : 'ai';
  });

  const showAi = isDesktop && tab === 'ai';

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#2c2c2e] border-r border-gray-100 dark:border-white/8 shadow-sm relative">
      {/* 날짜 선택 — 탭 공통 영역. AI 자동생성도 날짜가 필수 입력이라 어느 탭에서든 보여야 한다 */}
      <div className="relative">
        <Calendar
          key={calendarResetKey}
          onDatesConfirmed={() => {
            // 교통·숙소가 모두 비어있을 때만 자동 안내 — 날짜 재선택 시 이미 설정한 사용자를 방해하지 않음
            const isEmpty = !tripConfig.airportDepart && !tripConfig.airportArrive && !tripConfig.hotel;
            if (isEmpty) setShowTripSetup(true);
          }}
        />
        {/* AI 작업 중 날짜 변경 차단 — 자동생성 도중 resetDayPlans가 겹치면 일정이 깨진다 */}
        {aiBusy && <div className="absolute inset-0 z-10 bg-white/60 dark:bg-black/40 cursor-not-allowed" />}
      </div>

      {/* AI/검색 탭 — 데스크톱 전용. 모바일은 하단 탭바에서 AI로 진입한다 */}
      <div className="hidden md:flex border-b border-gray-100 dark:border-white/8 flex-shrink-0">
        {([
          { id: 'ai' as LeftTab, label: 'AI 도우미', icon: <Sparkles size={13} /> },
          { id: 'search' as LeftTab, label: '검색', icon: <Search size={13} /> },
        ]).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer
              ${tab === id
                ? 'text-[#2563EB] dark:text-[#60A5FA] border-b-2 border-[#2563EB] dark:border-[#60A5FA]'
                : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'
              }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* AI 탭 — 전환 시 언마운트돼도 대화는 sessionStorage로 복원된다 */}
      {showAi && (
        <div className="flex-1 min-h-0">
          <AiChatPanel city={city ?? ''} />
        </div>
      )}

      {/* 검색 탭 — 항상 마운트 유지(지도 이동 검색 결과 수신), AI 탭일 땐 숨김 */}
      <div className={`flex-1 min-h-0 ${showAi ? 'hidden' : 'flex flex-col'}`}>
        <SearchContainer initialQuery={initialQuery} />
      </div>

      {/* 날짜 확정 후 공항·호텔 설정 모달 */}
      {showTripSetup && <TripSetupModal onClose={() => setShowTripSetup(false)} />}
    </div>
  );
};

export default LeftPanel;
