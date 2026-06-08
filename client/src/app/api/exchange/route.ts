import { NextResponse } from 'next/server';

// open.er-api.com — 무인증·무료 실시간 환율. USD base로 받아 KRW 기준 환율을 직접 계산
// (수출입은행 고시환율은 영업일 1회 발표라 주말·공휴일엔 며칠 묵은 값이 떠 실시간 시세와 크게 벌어짐)
const ER_API_URL = 'https://open.er-api.com/v6/latest/USD';

// JPY는 100엔 기준으로 표시 (관례 + 수출입은행 표기와 통일)
const JPY_UNIT = 100;

// 표시 통화 → er-api 응답 코드. CNH(역외 위안)는 er-api에 없어 CNY(역내)로 대체
const CURRENCY_CODES: Record<string, string> = {
  USD: 'USD',
  JPY: 'JPY',
  EUR: 'EUR',
  GBP: 'GBP',
  THB: 'THB',
  CNH: 'CNY',
};

interface ErApiResponse {
  result: string;
  time_last_update_utc: string;
  rates: Record<string, number>;
}

export async function GET() {
  try {
    // Next.js fetch 캐시 — 10분간 결과 재사용. er-api는 분 단위로 갱신되지 않으므로 과호출 방지
    const res = await fetch(ER_API_URL, { next: { revalidate: 600 } });
    if (!res.ok) {
      return NextResponse.json({ error: '환율 데이터 없음' }, { status: 502 });
    }

    const data = (await res.json()) as ErApiResponse;
    if (data.result !== 'success' || !data.rates) {
      return NextResponse.json({ error: '환율 데이터 없음' }, { status: 502 });
    }

    // USD base 응답에서 1 USD = krwPerUsd 원. 다른 통화 X의 원화값 = krwPerUsd / rates[X]
    const krwPerUsd = data.rates['KRW'];
    if (!krwPerUsd) {
      return NextResponse.json({ error: '원화 환율 없음' }, { status: 502 });
    }

    const rates: Record<string, string> = {};
    for (const [displayCode, apiCode] of Object.entries(CURRENCY_CODES)) {
      const ratePerUsd = data.rates[apiCode];
      if (!ratePerUsd) continue;

      // 1 외화 = (KRW/USD) / (외화/USD) 원
      let krw = krwPerUsd / ratePerUsd;
      if (displayCode === 'JPY') krw *= JPY_UNIT; // 100엔 기준

      // 소수점 2자리까지 표시 — THB·CNH처럼 값이 작은 통화의 정밀도 보존
      rates[displayCode] = krw.toLocaleString('ko-KR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    // "Sun, 07 Jun 2026 00:02:31 +0000" → "2026-06-07"
    const updated = new Date(data.time_last_update_utc);
    const date = Number.isNaN(updated.getTime())
      ? new Date().toLocaleDateString('ko-KR')
      : `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, '0')}-${String(updated.getDate()).padStart(2, '0')}`;

    return NextResponse.json({ rates, date });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('환율 API 에러:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
