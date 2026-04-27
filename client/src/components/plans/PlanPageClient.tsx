'use client';
import { useState } from 'react';
import { Search, Map, ClipboardList } from 'lucide-react';
import SearchContainer from './SearchContainer';
import PlanContainer from './PlanContainer';
import MapContainer from './MapContainer';
import PlanEditLoader from './PlanEditLoader';

type Tab = 'search' | 'plan' | 'map';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'search', label: '검색',  icon: <Search size={20} /> },
  { id: 'plan',   label: '일정',  icon: <ClipboardList size={20} /> },
  { id: 'map',    label: '지도',  icon: <Map size={20} /> },
];

interface Props {
  initialQuery: string | null;
  initialCenter: { lat: number; lng: number } | null;
  editPlanNum: number | null;
}

// 모바일 탭 활성/비활성 클래스 — visibility 사용 (display:hidden 시 구글 맵이 크기를 0으로 인식해 마커 미렌더링)
// 데스크톱(md 이상)에선 항상 visible + relative로 3패널 나란히 배치
const panelClass = (isActive: boolean) =>
  `absolute inset-0 md:static md:inset-auto md:h-full ${
    isActive
      ? 'visible'
      : 'invisible pointer-events-none md:visible md:pointer-events-auto'
  }`;

export default function PlanPageClient({ initialQuery, initialCenter, editPlanNum }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('search');

  return (
    <div className="flex flex-col md:flex-row w-full h-full bg-gray-50 dark:bg-[#252527]">
      {editPlanNum && <PlanEditLoader planNum={editPlanNum} />}

      {/* 3패널 영역 — 모바일은 absolute로 겹쳐 두고 visibility 토글, 데스크톱은 static으로 나란히 배치 */}
      <div className="flex-1 md:flex-1 md:flex md:flex-row overflow-hidden relative min-h-0">
        <div className={`${panelClass(activeTab === 'search')} md:w-[20%] md:flex-shrink-0`}>
          <SearchContainer initialQuery={initialQuery} />
        </div>
        <div className={`${panelClass(activeTab === 'plan')} md:w-[20%] md:flex-shrink-0`}>
          <PlanContainer />
        </div>
        <div className={`${panelClass(activeTab === 'map')} md:flex-1 md:min-w-0`}>
          <MapContainer initialCenter={initialCenter} />
        </div>
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
                  ? 'text-gray-900 dark:text-rose-400'
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
