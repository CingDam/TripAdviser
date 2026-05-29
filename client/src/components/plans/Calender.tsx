'use client';
import usePlanStore from '@/store/usePlanStore';
import { useState, useEffect } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  isAfter, isBefore, isToday, differenceInCalendarDays, format,
} from 'date-fns';
import { ko } from 'date-fns/locale';

type Range = { from: Date; to: Date | null };
// 어떤 끝점을 다음 클릭으로 정할지 — 'from'은 첫 선택/출발일 재선택, 'to'는 도착일 선택 대기
type PickTarget = 'from' | 'to';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function buildGrid(base: Date): Date[] {
  const start = startOfWeek(startOfMonth(base));
  const end = endOfWeek(endOfMonth(base));
  const days: Date[] = [];
  let cur = start;
  while (!isAfter(cur, end)) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

const Calendar = ({ onDatesConfirmed }: { onDatesConfirmed?: () => void }) => {
  const resetDayPlans    = usePlanStore((s) => s.resetDayPlans);
  const setSelectedDate  = usePlanStore((s) => s.setSelectedDate);
  const currentStartDate = usePlanStore((s) => s.currentStartDate);
  const currentEndDate   = usePlanStore((s) => s.currentEndDate);

  const [range, setRange] = useState<Range | null>(null);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [month, setMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  // 다음 클릭이 정할 끝점 — 출발일 버튼은 'from', 도착일 버튼은 'to'
  const [pickTarget, setPickTarget] = useState<PickTarget>('from');

  // 수정 모드 진입 시 PlanEditLoader가 loadPlanData를 비동기로 호출하므로
  // useState 초기값이 아닌 useEffect로 스토어 날짜를 range에 동기화
  useEffect(() => {
    if (currentStartDate && currentEndDate) {
      setRange({ from: new Date(currentStartDate), to: new Date(currentEndDate) });
    }
  }, [currentStartDate, currentEndDate]);

  // 범위가 확정될 때 스토어에 반영하고 달력을 닫음 — 출발/도착 양쪽 확정 시 공통 호출
  const commitRange = (from: Date, to: Date) => {
    const days: string[] = [];
    const cur = new Date(from);
    while (!isAfter(cur, to)) {
      days.push(format(cur, 'yyyy-MM-dd'));
      cur.setDate(cur.getDate() + 1);
    }
    resetDayPlans(days);
    setSelectedDate(days[0]);
    setShowCalendar(false);
    onDatesConfirmed?.();
  };

  const handleDayClick = (day: Date) => {
    if (isBefore(day, new Date()) && !isToday(day)) return;

    // 출발일 재선택 모드 — 도착일을 유지한 채 출발일만 바꿈
    if (pickTarget === 'from' && range?.to) {
      // 새 출발일이 기존 도착일보다 뒤면 두 값을 교차 보정
      const [from, to] = isAfter(day, range.to) ? [range.to, day] : [day, range.to];
      setRange({ from, to });
      setPickTarget('from');
      commitRange(from, to);
      return;
    }

    // 도착일 재선택 모드 — 출발일 고정, 도착일만 바꿈
    if (pickTarget === 'to' && range?.from) {
      const from = range.from;
      const [finalFrom, to] = isAfter(day, from) ? [from, day] : [day, from];
      setRange({ from: finalFrom, to });
      setPickTarget('from');
      commitRange(finalFrom, to);
      return;
    }

    // 첫 선택 — 출발일만 지정하고 도착일 대기 상태로 전환
    setRange({ from: day, to: null });
    setPickTarget('to');
  };

  const isInRange = (day: Date) => {
    const from = range?.from;
    const to = range?.to ?? hovered;
    if (!from || !to) return false;
    const [s, e] = isAfter(to, from) ? [from, to] : [to, from];
    return isAfter(day, s) && isBefore(day, e);
  };

  const isStart = (day: Date) => !!range?.from && isSameDay(day, range.from);
  const isEnd   = (day: Date) => !!range?.to   && isSameDay(day, range.to);

  const isPast = (day: Date) => isBefore(day, new Date()) && !isToday(day);

  const grid = buildGrid(month);

  // 여행 일수 — 확정된 범위에만 표시 (예: 2박 3일)
  const nights = range?.from && range.to ? differenceInCalendarDays(range.to, range.from) : null;

  const openFor = (target: PickTarget) => {
    setPickTarget(target);
    setShowCalendar(true);
  };

  return (
    <div className="border-b border-gray-100 dark:border-white/8">
      {/* 출발일 / 도착일 */}
      <div className="flex items-stretch gap-2 p-3">
        <button
          onClick={() => openFor('from')}
          className={`flex-1 px-3 py-2 rounded-xl border bg-white dark:bg-white/5 hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-colors text-left cursor-pointer
            ${showCalendar && pickTarget === 'from'
              ? 'border-[#2563EB] dark:border-[#3B82F6] ring-2 ring-[#DBEAFE] dark:ring-[#2563EB]/20'
              : 'border-[#DBEAFE] dark:border-white/10'}`}
        >
          <div className="text-[10px] text-gray-400 dark:text-white/30 font-medium">출발일</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white/80 mt-0.5">
            {range?.from ? format(range.from, 'M월 d일 (eee)', { locale: ko }) : '날짜 선택'}
          </div>
        </button>

        <div className="flex flex-col items-center justify-center text-gray-300 dark:text-white/20 text-xs">
          <span>→</span>
          {nights !== null && (
            <span className="text-[10px] font-semibold text-[#2563EB] dark:text-[#60A5FA] whitespace-nowrap">
              {nights}박 {nights + 1}일
            </span>
          )}
        </div>

        <button
          onClick={() => openFor('to')}
          className={`flex-1 px-3 py-2 rounded-xl border bg-white dark:bg-white/5 hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-colors text-left cursor-pointer
            ${showCalendar && pickTarget === 'to'
              ? 'border-[#2563EB] dark:border-[#3B82F6] ring-2 ring-[#DBEAFE] dark:ring-[#2563EB]/20'
              : 'border-[#DBEAFE] dark:border-white/10'}`}
        >
          <div className="text-[10px] text-gray-400 dark:text-white/30 font-medium">도착일</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white/80 mt-0.5">
            {range?.to ? format(range.to, 'M월 d일 (eee)', { locale: ko }) : '날짜 선택'}
          </div>
        </button>
      </div>

      {/* 달력 */}
      {showCalendar && (
        <div className="px-3 pb-3">
          {/* 현재 어떤 날짜를 고르는 중인지 안내 */}
          <div className="mb-2 text-center text-xs font-medium text-[#2563EB] dark:text-[#60A5FA]">
            {pickTarget === 'from' ? '출발일을 선택하세요' : '도착일을 선택하세요'}
          </div>

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setMonth(subMonths(month, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-[#EFF6FF] hover:text-[#2563EB] dark:hover:bg-white/8 dark:hover:text-[#60A5FA] transition-colors cursor-pointer text-lg"
            >
              ‹
            </button>

            {/* 탭하면 월 선택 그리드 토글 */}
            <button
              onClick={() => setShowMonthPicker((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold text-gray-800 dark:text-white/85 hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-colors cursor-pointer"
            >
              {format(month, 'yyyy년 M월')}
              <span className={`text-[10px] text-gray-400 transition-transform duration-200 ${showMonthPicker ? 'rotate-180' : ''}`}>▾</span>
            </button>

            <button
              onClick={() => setMonth(addMonths(month, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-[#EFF6FF] hover:text-[#2563EB] dark:hover:bg-white/8 dark:hover:text-[#60A5FA] transition-colors cursor-pointer text-lg"
            >
              ›
            </button>
          </div>

          {/* 월 선택 그리드 */}
          {showMonthPicker && (
            <div className="mb-3">
              {/* 연도 선택 */}
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={() => setMonth(new Date(month.getFullYear() - 1, month.getMonth(), 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-[#EFF6FF] hover:text-[#2563EB] dark:hover:bg-white/8 transition-colors cursor-pointer"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold text-gray-700 dark:text-white/70">
                  {month.getFullYear()}년
                </span>
                <button
                  onClick={() => setMonth(new Date(month.getFullYear() + 1, month.getMonth(), 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-[#EFF6FF] hover:text-[#2563EB] dark:hover:bg-white/8 transition-colors cursor-pointer"
                >
                  ›
                </button>
              </div>
              {/* 월 버튼 3×4 */}
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((m, i) => {
                  const selected = i === month.getMonth();
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        setMonth(new Date(month.getFullYear(), i, 1));
                        setShowMonthPicker(false);
                      }}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer
                        ${selected
                          ? 'bg-[#2563EB] dark:bg-[#3B82F6] text-white font-semibold'
                          : 'text-gray-600 dark:text-white/60 hover:bg-[#EFF6FF] dark:hover:bg-white/8 hover:text-[#2563EB] dark:hover:text-[#93C5FD]'
                        }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 요일 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[0.65rem] font-semibold text-gray-400 dark:text-white/25 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              const outside = !isSameMonth(day, month);
              const past    = isPast(day);
              const start   = isStart(day);
              const end     = isEnd(day);
              const inRange = isInRange(day);
              const today   = isToday(day);

              let cellBg = '';
              if (start && !end) cellBg = 'bg-gradient-to-r from-transparent via-transparent to-[#EFF6FF] dark:to-[rgba(96,165,250,0.13)]';
              if (end && !start) cellBg = 'bg-gradient-to-l from-transparent via-transparent to-[#EFF6FF] dark:to-[rgba(96,165,250,0.13)]';
              if (inRange)       cellBg = 'bg-[#EFF6FF] dark:bg-[rgba(96,165,250,0.13)]';

              let btnStyle = 'text-gray-700 dark:text-white/65 hover:bg-[#EFF6FF] dark:hover:bg-white/8 hover:text-[#2563EB] dark:hover:text-[#93C5FD]';
              if (start || end)  btnStyle = 'bg-[#2563EB] dark:bg-[#3B82F6] text-white font-semibold';
              if (inRange)       btnStyle = 'text-[#2563EB] dark:text-[#93C5FD]';
              if (today && !start && !end) btnStyle += ' font-bold';
              if (outside || past) btnStyle = 'text-gray-300 dark:text-white/18 cursor-not-allowed';

              return (
                <div key={i} className={`relative flex items-center justify-center h-9 ${cellBg}`}>
                  <button
                    onClick={() => !outside && !past && handleDayClick(day)}
                    onMouseEnter={() => !outside && !past && setHovered(day)}
                    onMouseLeave={() => setHovered(null)}
                    disabled={outside || past}
                    className={`
                      w-8 h-8 rounded-lg text-[0.78rem] transition-colors flex items-center justify-center cursor-pointer
                      ${btnStyle}
                      ${today && !start && !end ? 'ring-1 ring-[#DBEAFE] dark:ring-white/15' : ''}
                    `}
                  >
                    {day.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
