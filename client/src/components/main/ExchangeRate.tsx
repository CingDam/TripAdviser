'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// 1분 주기 갱신 — 한국수출입은행 API 과호출 방지
const REFRESH_INTERVAL_MS = 60_000;

const CURRENCIES = [
  { code: 'USD', name: '미국 달러', flag: '🇺🇸' },
  { code: 'JPY', name: '일본 엔 (100)', flag: '🇯🇵' },
  { code: 'EUR', name: '유로', flag: '🇪🇺' },
  { code: 'GBP', name: '영국 파운드', flag: '🇬🇧' },
  { code: 'THB', name: '태국 바트', flag: '🇹🇭' },
  { code: 'CNY', name: '중국 위안화', flag: '🇨🇳' },
];

interface Rate {
  code: string;
  rate: string; // 문자열로 받아 처리 (콤마 포함 가능성)
}

const ExchangeRate = () => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/exchange');
      if (!res.ok) throw new Error('데이터 없음');

      const { rates, date } = await res.json();

      const parsed = CURRENCIES.map((curr) => ({
        code: curr.code,
        rate: rates[curr.code] ?? '-',
      }));

      setRates(parsed);
      setUpdatedAt(date ?? new Date().toLocaleDateString('ko-KR'));
    } catch (error) {
      console.error("환율 로드 실패:", error);
      setRates(CURRENCIES.map((curr) => ({ code: curr.code, rate: '-' })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // 마운트 1회만 실행 — fetchRates는 외부 상태 의존 없음

  return (
    <section className="py-20 bg-gray-50 dark:bg-[#1c1c1e]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-2 tracking-widest uppercase">Live Exchange Rate</p>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">오늘의 환율</h2>
            <p className="text-gray-500 dark:text-white/40 mt-2">한국수출입은행 실시간 고시 환율 (1분 주기 갱신)</p>
          </div>
          <button
            onClick={fetchRates}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/30 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {updatedAt ? `${updatedAt} 갱신` : '로드 중...'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {rates.length === 0 && loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-white dark:bg-white/4 animate-pulse border border-gray-100 dark:border-white/6" />
              ))
            : rates.map(({ code, rate }) => {
                const currency = CURRENCIES.find((c) => c.code === code)!;
                return (
                  <div
                    key={code}
                    className="rounded-2xl border border-gray-100 dark:border-white/8 p-4 bg-white dark:bg-[#2c2c2e] hover:border-gray-200 dark:hover:border-white/18 hover:shadow-sm dark:hover:bg-[#343436] transition-all"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{currency.flag}</span>
                      <span className="text-xs font-bold text-gray-400 dark:text-white/30">{code}</span>
                    </div>
                    <div className="text-lg font-extrabold text-gray-900 dark:text-white mt-1">
                      {rate === '-' || rate === '0' ? '-' : `₩${rate}`}
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-white/30 truncate">{currency.name}</div>
                  </div>
                );
              })}
        </div>
      </div>
    </section>
  );
};

export default ExchangeRate;
