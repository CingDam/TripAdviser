import placeTypesJson from '@/constants/placeTypes.json';

// JSON import는 키가 고정 리터럴로 추론돼서 string 인덱싱 불가 → as로 해결
const TYPE_LABEL = placeTypesJson as Record<string, { label: string; color: string; emoji: string }>;

export function getTag(types: string[]): { label: string; color: string; emoji: string } | null {
  for (const t of types) {
    if (TYPE_LABEL[t]) return TYPE_LABEL[t];
  }
  return null;
}

// priceLevel(0~4) → $ 기호 문자열로 변환
export function getPriceLabel(priceLevel: number | null | undefined): string | null {
  if (priceLevel == null) return null;
  const labels = ['무료', '$', '$$', '$$$', '$$$$'];
  return labels[priceLevel] ?? null;
}
