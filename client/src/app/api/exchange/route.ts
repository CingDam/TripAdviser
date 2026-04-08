import { NextResponse } from 'next/server';
import https from 'node:https';

// 한국수출입은행 환율 API — 영업일 기준, 당일 API 오픈 전(오전 11시경)엔 데이터 없음
// 최대 7일 이전까지 순차 조회하여 가장 최근 영업일 데이터를 반환
// www.koreaexim.go.kr SSL 인증서 체인 불완전 → Node https 모듈로 직접 요청
const EXIM_API_URL = 'https://www.koreaexim.go.kr/site/program/financial/exchangeJSON';
const CURRENCIES = ['USD', 'JPY', 'EUR', 'GBP', 'THB', 'CNH'];
const MAX_FALLBACK_DAYS = 7;

// SSL 검증 비활성화 agent — 수출입은행 인증서 체인 문제 우회
const agent = new https.Agent({ rejectUnauthorized: false });

interface EximRate {
  cur_unit: string;   // "USD", "JPY(100)", ...
  deal_bas_r: string; // "1,234.56" 형태 문자열
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function httpsGetRaw(url: string, cookie?: string): Promise<{ status: number; headers: Record<string, string | string[]>; body: string }> {
  return new Promise((resolve, reject) => {
    const options = { agent, headers: cookie ? { Cookie: cookie } : {} };
    https.get(url, options, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        headers: res.headers as Record<string, string | string[]>,
        body,
      }));
    }).on('error', reject);
  });
}

async function httpsGet(url: string): Promise<unknown> {
  // 수출입은행 서버는 쿠키 확인용 302 리다이렉트를 먼저 보냄 — 쿠키를 추출해 재요청
  const first = await httpsGetRaw(url);
  if (first.status === 302) {
    const location = first.headers['location'] as string;
    const redirectUrl = location.startsWith('http')
      ? location
      : `https://www.koreaexim.go.kr${location}`;

    const rawCookies = first.headers['set-cookie'];
    const cookie = Array.isArray(rawCookies)
      ? rawCookies.map((c) => c.split(';')[0]).join('; ')
      : String(rawCookies).split(';')[0];

    const second = await httpsGetRaw(redirectUrl, cookie);
    return JSON.parse(second.body);
  }
  return JSON.parse(first.body);
}

async function fetchByDate(authkey: string, date: string): Promise<EximRate[] | null> {
  const url = `${EXIM_API_URL}?authkey=${authkey}&searchdate=${date}&data=AP01`;

  // ECONNRESET 등 일시적 오류 시 1회 재시도 — 수출입은행 서버가 연결을 간헐적으로 끊음
  let json: unknown;
  try {
    json = await httpsGet(url);
  } catch {
    json = await httpsGet(url);
  }

  // API 오픈 전·휴일·인증 실패 시 빈 배열 또는 { RESULT: 2, ... } 형태로 내려옴
  if (!Array.isArray(json) || json.length === 0) return null;

  // RESULT 필드가 있으면 에러 응답 (1=정상, 그 외=비정상)
  const first = json[0] as Record<string, unknown>;
  if ('RESULT' in first && first['RESULT'] !== 1) return null;

  return json as EximRate[];
}

export async function GET() {
  const authkey = process.env.EXCHANGE_API_KEY;
  if (!authkey) {
    return NextResponse.json({ error: 'API 키 없음' }, { status: 500 });
  }

  try {
    let data: EximRate[] | null = null;
    let foundDate = '';

    // 오늘부터 최대 7일 이전까지 순차 조회 — 당일 API 오픈 전이거나 공휴일이면 이전 영업일 사용
    for (let i = 0; i < MAX_FALLBACK_DAYS; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = formatDate(d);
      data = await fetchByDate(authkey, date);
      if (data) {
        foundDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
        break;
      }
    }

    if (!data) {
      return NextResponse.json({ error: '환율 데이터 없음' }, { status: 502 });
    }

    const rates: Record<string, string> = {};
    for (const cur of CURRENCIES) {
      // JPY는 API에서 "JPY(100)" 키로 내려옴 — 100엔 기준 환율
      const apiKey = cur === 'JPY' ? 'JPY(100)' : cur;
      const row = data.find((r) => r.cur_unit === apiKey);
      if (row) {
        // "1,234.56" → 숫자로 변환 후 정수로 반올림
        const numeric = parseFloat(row.deal_bas_r.replace(/,/g, ''));
        rates[cur] = Math.round(numeric).toLocaleString('ko-KR');
      }
    }

    return NextResponse.json({ rates, date: foundDate });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('환율 API 에러:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
