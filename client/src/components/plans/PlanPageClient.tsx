'use client';
import { useState, useEffect } from 'react';
import { Search, Map, ClipboardList, Sparkles } from 'lucide-react';
import LeftPanel from './LeftPanel';
import PlanContainer from './PlanContainer';
import MapContainer from './MapContainer';
import AiChatPanel from './AiChatPanel';
import PlanEditLoader from './PlanEditLoader';
import usePlanStore from '@/store/usePlanStore';

type Tab = 'ai' | 'search' | 'plan' | 'map';

// AI 자동생성이 메인 여정 — AI를 첫 탭으로, 이후 다듬기(검색)→확인(일정)→지형(지도) 빈도순
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'ai',     label: 'AI',    icon: <Sparkles size={20} /> },
  { id: 'search', label: '검색',  icon: <Search size={20} /> },
  { id: 'plan',   label: '일정',  icon: <ClipboardList size={20} /> },
  { id: 'map',    label: '지도',  icon: <Map size={20} /> },
];

interface Props {
  initialQuery: string | null;
  initialCenter: { lat: number; lng: number } | null;
  editPlanNum: number | null;
  city: string | null;
}

// 모바일 탭 활성/비활성 클래스 — visibility 사용 (display:hidden 시 구글 맵이 크기를 0으로 인식해 마커 미렌더링)
// 데스크톱(md 이상)에선 항상 visible + relative로 3패널 나란히 배치
const panelClass = (isActive: boolean) =>
  `absolute inset-0 md:static md:inset-auto md:h-full ${
    isActive
      ? 'visible'
      : 'invisible pointer-events-none md:visible md:pointer-events-auto'
  }`;

export default function PlanPageClient({ initialQuery, initialCenter, editPlanNum, city }: Props) {
  // 모바일 초기 탭 — 수정 모드는 채워진 일정 확인부터, 신규는 날짜 선택이 있는 검색부터
  const [activeTab, setActiveTab] = useState<Tab>(editPlanNum ? 'plan' : 'search');
  const [isPlanCollapsed, setIsPlanCollapsed] = useState(false);
  const selectedPlace = usePlanStore((s) => s.selectedPlace);

  // md(768px) 이상 여부 — AI 챗봇 인스턴스를 데스크톱(좌측 패널)·모바일(하단 탭) 중
  // 한쪽에만 마운트하기 위함. 둘 다 마운트하면 대화 sessionStorage가 이중 기록된다
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // 마커 클릭(selectedPlace 변경) 시 모바일에서 search 탭으로 자동 전환 — 지도에서 장소 선택 후 카드가 보이도록
  useEffect(() => {
    if (selectedPlace) setActiveTab('search');
  }, [selectedPlace]);

  return (
    <div className="flex flex-col md:flex-row w-full h-full bg-gray-50 dark:bg-[#252527]">
      {editPlanNum && <PlanEditLoader planNum={editPlanNum} />}

      {/* 3패널 영역 — 모바일은 absolute로 겹쳐 두고 visibility 토글, 데스크톱은 static으로 나란히 배치 */}
      <div className="flex-1 md:flex-1 md:flex md:flex-row overflow-hidden relative min-h-0">
        <div className={`${panelClass(activeTab === 'search')} md:w-[20%] md:flex-shrink-0`}>
          <LeftPanel
            initialQuery={initialQuery}
            city={city}
            isEdit={editPlanNum !== null}
            isDesktop={isDesktop}
          />
        </div>
        {/* 접힌 상태에서 md:w-10, 펼쳐진 상태에서 md:w-[20%] — 모바일은 항상 inset-0 fullscreen */}
        <div className={`${panelClass(activeTab === 'plan')} ${isPlanCollapsed ? 'md:w-10' : 'md:w-[20%]'} md:flex-shrink-0 md:transition-all md:duration-300`}>
          <PlanContainer isCollapsed={isPlanCollapsed} onCollapse={setIsPlanCollapsed} />
        </div>
        <div className={`${panelClass(activeTab === 'map')} md:flex-1 md:min-w-0`}>
          <MapContainer initialCenter={initialCenter} initialQuery={initialQuery} />
        </div>
        {/* AI 탭 — 모바일 전용. 데스크톱에서는 좌측 패널의 AI 탭으로 접근 */}
        {!isDesktop && (
          <div className={panelClass(activeTab === 'ai')}>
            <AiChatPanel city={city ?? ''} />
          </div>
        )}
      </div>

      {/* 하단 탭바 — 모바일에서만 표시 */}
      <nav className="md:hidden flex-shrink-0 flex bg-white dark:bg-[#2c2c2e] border-t border-gray-100 dark:border-white/8 safe-bottom">
        {TABS.map(({ id, label, icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors cursor-pointer
                ${isActive
                  ? 'text-gray-900 dark:text-[#60A5FA]'
                  : 'text-gray-400 dark:text-white/30'
                }`}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
