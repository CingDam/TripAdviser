'use client';
import usePlanStore from '@/store/usePlanStore';
import { useState, useEffect } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  isAfter, isBefore, isToday, format,
} from 'date-fns';
import { ko } from 'date-fns/locale';

type Range = { from: Date; to: Date | null };

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

const Calendar = () => {
  const resetDayPlans    = usePlanStore((s) => s.resetDayPlans);
  const setSelectedDate  = usePlanStore((s) => s.setSelectedDate);
  const currentStartDate = usePlanStore((s) => s.currentStartDate);
  const currentEndDate   = usePlanStore((s) => s.currentEndDate);

  const [range, setRange] = useState<Range | null>(null);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [month, setMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // 수정 모드 진입 시 PlanEditLoader가 loadPlanData를 비동기로 호출하므로
  // useState 초기값이 아닌 useEffect로 스토어 날짜를 range에 동기화
  useEffect(() => {
    if (currentStartDate && currentEndDate) {
      setRange({ from: new Date(currentStartDate), to: new Date(currentEndDate) });
    }
  }, [currentStartDate, currentEndDate]);

  const handleDayClick = (day: Date) => {
    if (isBefore(day, new Date()) && !isToday(day)) return;

    if (!range?.from || (range.from && range.to)) {
      setRange({ from: day, to: null });
      return;
    }

    const from = range.from;
    const to = isAfter(day, from) ? day : from;
    const finalFrom = isAfter(day, from) ? from : day;

    setRange({ from: finalFrom, to });

    const days: string[] = [];
    const cur = new Date(finalFrom);
    while (!isAfter(cur, to)) {
      days.push(format(cur, 'yyyy-MM-dd'));
      cur.setDate(cur.getDate() + 1);
    }
    resetDayPlans(days);
    setSelectedDate(days[0]);
    setShowCalendar(false);
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

  return (
    <div className="border-b border-gray-100 dark:border-white/8">
      {/* 출발일 / 도착일 */}
      <div className="flex gap-2 p-3">
        <button
          onClick={() => { setRange(null); setShowCalendar(true); }}
          className="flex-1 px-3 py-2 rounded-xl border border-[#DBEAFE] dark:border-white/10 bg-white dark:bg-white/5 hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-colors text-left cursor-pointer"
        >
          <div className="text-[10px] text-gray-400 dark:text-white/30 font-medium">출발일</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white/80 mt-0.5">
            {range?.from ? format(range.from, 'M월 d일 (eee)', { locale: ko }) : '날짜 선택'}
          </div>
        </button>

        <div className="flex items-center text-gray-300 dark:text-white/20 text-xs">→</div>

        <button
          onClick={() => setShowCalendar(true)}
          className="flex-1 px-3 py-2 rounded-xl border border-[#DBEAFE] dark:border-white/10 bg-white dark:bg-white/5 hover:bg-[#EFF6FF] dark:hover:bg-white/8 transition-colors text-left cursor-pointer"
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
