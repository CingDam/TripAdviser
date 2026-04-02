'use client';
import usePlanStore from '@/store/usePlanStore';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { useState } from 'react';

const Calendar = () => {
  const resetDayPlans = usePlanStore((state) => state.resetDayPlans);
  const setSelectedDate = usePlanStore((state) => state.setSelectedDate);

  const [range, setRange] = useState<DateRange | undefined>();
  const [showCalendar, setShowCalendar] = useState(false);

  const handleSelect = (newRange: DateRange | undefined) => {
    if (!newRange) { setRange(undefined); return; }

    // react-day-picker는 첫 클릭에 { from, to: same } 을 줄 수 있음
    // 이전에 from이 없었다면 → 출발일만 고른 첫 클릭이므로 to를 비워 달력 유지
    if (!range?.from && newRange.from && newRange.to &&
        newRange.from.getTime() === newRange.to.getTime()) {
      setRange({ from: newRange.from, to: undefined });
      return;
    }

    setRange(newRange);
    // from, to 둘 다 확정됐을 때 (당일치기 포함)
    if (newRange.from && newRange.to) {
      const days: string[] = [];
      const current = new Date(newRange.from);
      while (current <= newRange.to) {
        days.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
      resetDayPlans(days);
      setSelectedDate(days[0]);
      setShowCalendar(false);
    }
  };

  return (
    <div className="border-b border-gray-100">
      {/* 출발일 / 도착일 버튼 */}
      <div className="flex gap-2 p-3">
        <button
          onClick={() => { setRange(undefined); setShowCalendar(true); }}
          className="flex-1 px-3 py-2 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 transition-colors text-left cursor-pointer"
        >
          <div className="text-[10px] text-gray-400 font-medium">출발일</div>
          <div className="text-sm font-bold text-indigo-600 mt-0.5">
            {range?.from ? range.from.toLocaleDateString('ko-KR') : '날짜 선택'}
          </div>
        </button>

        <div className="flex items-center text-gray-300 text-xs">→</div>

        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="flex-1 px-3 py-2 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 transition-colors text-left cursor-pointer"
        >
          <div className="text-[10px] text-gray-400 font-medium">도착일</div>
          <div className="text-sm font-bold text-indigo-600 mt-0.5">
            {range?.to ? range.to.toLocaleDateString('ko-KR') : '날짜 선택'}
          </div>
        </button>
      </div>

      {/* 달력 드롭다운 */}
      {showCalendar && (
        <div className="px-2 pb-2">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleSelect}
            disabled={{ before: new Date() }}
          />
        </div>
      )}
    </div>
  );
};

export default Calendar;
