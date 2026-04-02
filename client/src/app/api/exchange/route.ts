// src/app/api/exchange/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const authkey = decodeURIComponent(process.env.EXCHANGE_API_KEY || '');
    const today = new Date();
    
    // 날짜 처리 (주말 체크)
    const day = today.getDay();
    if (day === 0) today.setDate(today.getDate() - 2); // 일 -> 금
    else if (day === 6) today.setDate(today.getDate() - 1); // 토 -> 금

    const searchdate = today.toISOString().split('T')[0].replace(/-/g, '');
    
    // 주소 끝에 &data=AP01 확인
    const url = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${authkey}&searchdate=${searchdate}&data=AP01`;

    console.log("요청 URL:", url); // 터미널(VSCode) 로그 확인용

    const res = await fetch(url);
    const data = await res.json();

    // API 응답이 비어있는지 확인
    if (!Array.isArray(data) || data.length === 0) {
      console.log("API 응답 데이터 없음 (주말/영업시간 전)");
      return NextResponse.json({ error: '데이터 없음' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("서버 내부 에러 상세:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}