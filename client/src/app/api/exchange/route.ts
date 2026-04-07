// src/app/api/exchange/route.ts
// frankfurter.app — ECB 기반 무료 환율 API, 키 불필요, SSL 문제 없음
import { NextResponse } from 'next/server';

const CURRENCIES = ['USD', 'JPY', 'EUR', 'GBP', 'THB', 'CNY'];

export async function GET() {
  try {
    // KRW 기준으로 각 통화 환율 조회 → rates: { USD: 0.00073, JPY: 0.107, ... }
    // 역수를 취하면 "1 USD = ? KRW" 형태로 변환 가능
    const url = `https://api.frankfurter.app/latest?from=KRW&to=${CURRENCIES.join(',')}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
    }

    const json = await res.json();
    // json.rates: { USD: 0.00073, JPY: 0.107, ... }
    // 역수 계산 → 1 외화 = ? KRW
    const rates: Record<string, string> = {};
    for (const cur of CURRENCIES) {
      const rate = json.rates?.[cur];
      if (rate) {
        // JPY는 100엔 단위로 표시
        const krw = cur === 'JPY' ? (100 / rate) : (1 / rate);
        rates[cur] = Math.round(krw).toLocaleString('ko-KR');
      }
    }

    return NextResponse.json({ rates, date: json.date });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('환율 API 에러:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}