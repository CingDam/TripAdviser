'use client';
import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

// 항공편 시각 입력 — 내부 저장 포맷은 "HH:mm"(24시간)으로 고정,
// 화면에는 오전/오후 + 12시간제로 보여준다. 키보드 직접 입력과 드롭다운 선택을 모두 지원.
interface TimeFieldProps {
  // null이면 미입력. 저장 포맷은 항상 "HH:mm" 24시간제
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1~12
// 5분 단위 — 항공편 시각은 분 단위 정밀도가 필요 없고 목록이 길면 고르기 어렵다
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

const pad = (n: number) => String(n).padStart(2, '0');

// "HH:mm"(24h) → { meridiem, hour12, minute }. 빈 값은 null 반환
const parse24 = (value: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const meridiem: 'AM' | 'PM' = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { meridiem, hour12, minute: m };
};

// { meridiem, hour12, minute } → "HH:mm"(24h)
const to24 = (meridiem: 'AM' | 'PM', hour12: number, minute: number): string => {
  let h = hour12 % 12; // 12 → 0
  if (meridiem === 'PM') h += 12;
  return `${pad(h)}:${pad(minute)}`;
};

// 키보드 입력 텍스트를 관대하게 해석 — "0930", "9:30", "오후 9:30", "21:30" 등
// 실패하면 null. 성공하면 "HH:mm"(24h)
const parseTyped = (raw: string): string | null => {
  const text = raw.trim();
  if (!text) return null;
  const isPM = /pm|오후/i.test(text);
  const isAM = /am|오전/i.test(text);
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;

  let h: number;
  let m: number;
  if (digits.length <= 2) {
    h = Number(digits);
    m = 0;
  } else {
    // 뒤 2자리는 분, 앞은 시
    m = Number(digits.slice(-2));
    h = Number(digits.slice(0, -2));
  }
  if (Number.isNaN(h) || Number.isNaN(m) || m > 59) return null;

  // 오전/오후가 명시되면 12시간제로 해석, 아니면 입력값을 24시간제로 간주
  if (isAM || isPM) {
    if (h < 1 || h > 12) return null;
    return to24(isPM ? 'PM' : 'AM', h, m);
  }
  if (h > 23) return null;
  return `${pad(h)}:${pad(m)}`;
};

// "HH:mm"(24h) → "오전 07:30" 표시 문자열
const formatDisplay = (value: string | null): string => {
  const parsed = parse24(value);
  if (!parsed) return '';
  return `${parsed.meridiem === 'AM' ? '오전' : '오후'} ${pad(parsed.hour12)}:${pad(parsed.minute)}`;
};

const TimeField = ({ value, onChange, label }: TimeFieldProps) => {
  const [open, setOpen] = useState(false);
  // 타이핑 중 텍스트 — 포커스 동안에는 자유 입력, blur 시 확정/표시 문자열로 동기화
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const parsed = parse24(value);

  // 외부 value가 바뀌고 입력 중이 아닐 때 표시 문자열 동기화
  useEffect(() => {
    if (!focused) setText(formatDisplay(value));
  }, [value, focused]);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const commitTyped = () => {
    setFocused(false);
    if (text.trim() === '') {
      onChange(null);
      setText('');
      return;
    }
    const result = parseTyped(text);
    if (result) {
      onChange(result);
      setText(formatDisplay(result));
    } else {
      // 해석 실패 — 직전 유효값으로 되돌림
      setText(formatDisplay(value));
    }
  };

  // 드롭다운에서 한 축을 고르면 나머지는 현재값(없으면 기본값)을 유지
  const pick = (next: Partial<{ meridiem: 'AM' | 'PM'; hour12: number; minute: number }>) => {
    const base = parsed ?? { meridiem: 'AM' as const, hour12: 9, minute: 0 };
    const merged = { ...base, ...next };
    onChange(to24(merged.meridiem, merged.hour12, merged.minute));
  };

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-gray-500 dark:text-white/40">{label}</span>

      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-white dark:bg-[#252527] transition-all
          ${open
            ? 'border-[#2563EB] dark:border-[#3B82F6] ring-2 ring-[#DBEAFE] dark:ring-[#2563EB]/20'
            : 'border-[#DBEAFE] dark:border-white/10'
          }`}
      >
        <input
          value={text}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { commitTyped(); setOpen(false); (e.target as HTMLInputElement).blur(); }
            if (e.key === 'Escape') { setText(formatDisplay(value)); setOpen(false); (e.target as HTMLInputElement).blur(); }
          }}
          placeholder="오전 09:00"
          className="flex-1 min-w-0 bg-transparent text-xs text-gray-800 dark:text-white/80 outline-none placeholder:text-gray-300 dark:placeholder:text-white/20"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[#2563EB] dark:text-[#60A5FA] hover:opacity-70 transition-opacity cursor-pointer flex-shrink-0"
          aria-label="시간 선택 열기"
        >
          <Clock size={14} />
        </button>
      </div>

      {/* 드롭다운 — 오전/오후 · 시 · 분 3열 휠 선택
          모달 하단에 위치해 아래로 열면 overflow-y-auto에 잘리므로 위로 펼친다 */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-1 p-2 rounded-xl border border-[#DBEAFE] dark:border-white/10 bg-white dark:bg-[#2c2c2e] shadow-xl">
          <div className="flex gap-1.5">
            {/* 오전/오후 */}
            <div className="flex flex-col gap-1 w-12">
              {(['AM', 'PM'] as const).map((mer) => (
                <button
                  key={mer}
                  type="button"
                  onClick={() => pick({ meridiem: mer })}
                  className={`py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer
                    ${(parsed?.meridiem ?? 'AM') === mer
                      ? 'bg-[#2563EB] dark:bg-[#3B82F6] text-white'
                      : 'text-gray-500 dark:text-white/40 hover:bg-[#EFF6FF] dark:hover:bg-white/5'
                    }`}
                >
                  {mer === 'AM' ? '오전' : '오후'}
                </button>
              ))}
            </div>

            {/* 시 */}
            <div className="flex-1 flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {HOURS_12.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => pick({ hour12: h })}
                  className={`py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer
                    ${parsed?.hour12 === h
                      ? 'bg-[#EFF6FF] dark:bg-[#2563EB]/20 text-[#2563EB] dark:text-[#60A5FA]'
                      : 'text-gray-600 dark:text-white/50 hover:bg-[#EFF6FF] dark:hover:bg-white/5'
                    }`}
                >
                  {pad(h)}시
                </button>
              ))}
            </div>

            {/* 분 — 5분 단위 */}
            <div className="flex-1 flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => pick({ minute: m })}
                  className={`py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer
                    ${parsed?.minute === m
                      ? 'bg-[#EFF6FF] dark:bg-[#2563EB]/20 text-[#2563EB] dark:text-[#60A5FA]'
                      : 'text-gray-600 dark:text-white/50 hover:bg-[#EFF6FF] dark:hover:bg-white/5'
                    }`}
                >
                  {pad(m)}분
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeField;
