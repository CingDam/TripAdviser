import placeTypesJson from '@/constants/placeTypes.json';
import {
  Utensils, Coffee, Landmark, Trees,
  ShoppingBag, ShoppingCart, BedDouble, GlassWater,
  TrainFront, Bus, Plane, MapPin,
  type LucideIcon,
} from 'lucide-react';

// JSON import는 키가 고정 리터럴로 추론돼서 string 인덱싱 불가 → as로 해결
const TYPE_LABEL = placeTypesJson as Record<string, { label: string; color: string; icon: string }>;

const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  Coffee,
  Landmark,
  Trees,
  ShoppingBag,
  ShoppingCart,
  BedDouble,
  GlassWater,
  TrainFront,
  Bus,
  Plane,
};

export type PlaceTag = { label: string; color: string; Icon: LucideIcon };

export function getTag(types: string[]): PlaceTag | null {
  for (const t of types) {
    const entry = TYPE_LABEL[t];
    if (entry) {
      return {
        label: entry.label,
        color: entry.color,
        Icon: ICON_MAP[entry.icon] ?? MapPin,
      };
    }
  }
  return null;
}

// priceLevel(0~4) → $ 기호 문자열로 변환
export function getPriceLabel(priceLevel: number | null | undefined): string | null {
  if (priceLevel == null) return null;
  const labels = ['무료', '$', '$$', '$$$', '$$$$'];
  return labels[priceLevel] ?? null;
}
