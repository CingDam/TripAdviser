'use client';
import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const CURRENCIES = [
  { code: 'USD', name: '미국 달러', flag: '🇺🇸' },
  { code: 'JPY', name: '일본 엔 (100)', flag: '🇯🇵' },
  { code: 'EUR', name: '유로', flag: '🇪🇺' },
  { code: 'GBP', name: '영국 파운드', flag: '🇬🇧' },
  { code: 'THB', name: '태국 바트', flag: '🇹🇭' },
  { code: 'CNH', name: '중국 위안화', flag: '🇨🇳' },
];

interface Rate {
  code: string;
  rate: string; // 문자열로 받아 처리 (콤마 포함 가능성)
}

const ExchangeRate = () => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/exchange'); // 위에서 만든 API Route 호출
      if (!res.ok) throw new Error('데이터 없음');
      
      const data = await res.json();

      console.log(data);

      const parsed = CURRENCIES.map((curr) => {
        const targetUnit = curr.code === 'JPY' ? 'JPY(100)' : curr.code;
        const match = data.find((item: any) => item.cur_unit === targetUnit);
        
        return {
          code: curr.code,
          // deal_bas_r 대신 tts(살 때 환율)를 사용
          rate: match ? match.tts : '0', 
        };
      });

      setRates(parsed);
      setUpdatedAt(new Date().toLocaleTimeString('ko-KR', { 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      }));
    } catch (error) {
      console.error("환율 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, [fetchRates]);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm font-semibold text-indigo-600 mb-2">LIVE EXCHANGE RATE</p>
            <h2 className="text-3xl font-extrabold text-gray-900">오늘의 환율</h2>
            <p className="text-gray-500 mt-2">한국수출입은행 실시간 고시 환율 (1분 주기 갱신)</p>
          </div>
          <button
            onClick={fetchRates}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {updatedAt ? `${updatedAt} 갱신` : '로드 중...'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {rates.length === 0 && loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-gray-50 animate-pulse border border-gray-100" />
              ))
            : rates.map(({ code, rate }) => {
                const currency = CURRENCIES.find((c) => c.code === code)!;
                return (
                  <div key={code} className="rounded-2xl border border-gray-100 p-4 bg-white hover:border-indigo-200 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{currency.flag}</span>
                      <span className="text-xs font-bold text-gray-400">{code}</span>
                    </div>
                    <div className="text-lg font-extrabold text-gray-900 mt-1">
                      ₩{rate}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">{currency.name}</div>
                  </div>
                );
              })}
        </div>
      </div>
    </section>
  );
};

export default ExchangeRate;