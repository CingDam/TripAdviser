'use client';
import { useState } from 'react';
import { CalendarDays, Copy, ChevronRight } from 'lucide-react';
import Button from '@/components/common/Button';
import { AttachedPlan, AttachedDayPlan } from '@/types/community';

interface AttachedPlanCardProps {
  plan: AttachedPlan;
  isOwnPost: boolean;
  isCloning: boolean;
  onClone: () => void;
}

// 일자별 dayPlans를 planDate 기준으로 그룹화 — Map으로 순서 보장
function groupByDate(dayPlans: AttachedDayPlan[]): Map<string, AttachedDayPlan[]> {
  const map = new Map<string, AttachedDayPlan[]>();
  for (const dp of dayPlans) {
    const arr = map.get(dp.planDate) ?? [];
    arr.push(dp);
    map.set(dp.planDate, arr);
  }
  return map;
}

function formatPlanPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  // 같은 달이면 '5.1 ~ 5.4', 다른 달이면 '4.30 ~ 5.4' — 짧고 가독성 좋게
  const [, sm, sd] = start.split('-');
  const [, em, ed] = end.split('-');
  const left = `${Number(sm)}.${Number(sd)}`;
  const right = sm === em ? `${Number(ed)}` : `${Number(em)}.${Number(ed)}`;
  return `${left} ~ ${right}`;
}

export default function AttachedPlanCard({ plan, isOwnPost, isCloning, onClone }: AttachedPlanCardProps) {
  const grouped = groupByDate(plan.dayPlans);
  const dates = Array.from(grouped.keys());
  const totalPlaces = plan.dayPlans.length;
  const period = formatPlanPeriod(plan.startDate, plan.endDate);

  // 모든 일자를 기본 펼친 상태로 시작 — 사용자 결정에 따라 1번 옵션이 일자별 펼침이라 처음부터 보여줌
  const [expanded, setExpanded] = useState<Set<string>>(new Set(dates));

  const toggle = (date: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-[#2563EB]/30 dark:border-[#60A5FA]/20 bg-[#EFF6FF]/60 dark:bg-[#252527] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#DBEAFE] dark:border-white/8">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">
            <CalendarDays size={12} />
            첨부된 일정
          </span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white/90 truncate">
            {plan.planName}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-white/40">
            {plan.city && <span>{plan.city.cityName} · {plan.city.country}</span>}
            {period && plan.city && <span className="text-gray-300 dark:text-white/15">·</span>}
            {period && <span>{period}</span>}
            <span className="text-gray-300 dark:text-white/15">·</span>
            <span>장소 {totalPlaces}개</span>
          </div>
        </div>
        {/* 본인 게시글에는 가져가기 숨김 — 본인 일정 복제는 의미 없음 */}
        {!isOwnPost && (
          <Button
            variant="primary"
            size="sm"
            onClick={onClone}
            disabled={isCloning}
            className="flex items-center gap-1 flex-shrink-0"
          >
            <Copy size={11} />
            {isCloning ? '가져오는 중...' : '내 일정으로 가져가기'}
          </Button>
        )}
      </div>

      {/* 일자별 장소 — 아코디언 */}
      <div className="flex flex-col">
        {dates.map((date, dayIdx) => {
          const items = grouped.get(date) ?? [];
          const isOpen = expanded.has(date);
          return (
            <div key={date} className="border-b border-[#DBEAFE]/60 dark:border-white/5 last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(date)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA]">Day {dayIdx + 1}</span>
                  <span className="text-xs text-gray-500 dark:text-white/40">{date}</span>
                  <span className="text-[11px] text-gray-400 dark:text-white/30">· {items.length}개</span>
                </div>
                <ChevronRight
                  size={14}
                  className={`text-gray-400 dark:text-white/30 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>
              {isOpen && (
                <ul className="px-5 pb-3 flex flex-col gap-1.5">
                  {items.map((item, idx) => (
                    <li
                      key={item.dayPlanNum}
                      className="flex items-start gap-2 text-xs text-gray-700 dark:text-white/70"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#2563EB]/10 dark:bg-[#60A5FA]/15 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-semibold text-gray-900 dark:text-white/85 truncate">
                          {item.locationName ?? '이름 없음'}
                        </span>
                        {item.address && (
                          <span className="text-[11px] text-gray-400 dark:text-white/30 truncate">
                            {item.address}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
