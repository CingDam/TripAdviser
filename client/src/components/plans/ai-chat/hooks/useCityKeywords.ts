'use client';
import { useState, useEffect } from 'react';
import { nestApi } from '@/config/api.config';
import { FALLBACK_CITY_KEYWORDS } from '../utils/detect';

interface CityRow { cityName: string }

// /api/city에서 도시명을 받아와 fallback 목록과 병합 — 중복 제거 후 반환
export function useCityKeywords(): string[] {
  const [keywords, setKeywords] = useState<string[]>(FALLBACK_CITY_KEYWORDS);

  useEffect(() => {
    nestApi.get<CityRow[]>('/city').then((res) => {
      const dbNames = (res.data ?? []).map((c) => c.cityName);
      const merged = Array.from(new Set([...dbNames, ...FALLBACK_CITY_KEYWORDS]));
      setKeywords(merged);
    }).catch(() => {
      // 서버 오류 시 fallback 목록으로 유지
    });
  }, []);

  return keywords;
}
