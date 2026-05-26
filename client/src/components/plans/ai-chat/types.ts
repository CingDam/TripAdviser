export type ChatActionPlace = { name: string; category?: string | null };

export interface ChatAction {
  places: (ChatActionPlace | string)[];
  target_date?: string | null;
  remove_names?: string[];
  // Agent가 conversation_city로 장소를 찾은 경우 — props.city와 다를 수 있으므로 resolve 시 이 도시 사용
  city?: string | null;
}

export interface MessageContext {
  city?: string;
}

export interface ThinkingStep {
  step: number;
  tool: string;
  label: string;
  summary?: string;
  ok?: boolean;
}

export interface Message {
  role: 'user' | 'ai';
  text: string;
  action?: ChatAction;
  isError?: boolean;
  followUps?: string[];
  context?: MessageContext;
  timestamp?: string;
  thinkingSteps?: ThinkingStep[];
  thinkingMs?: number;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  관광지: '🏛',
  식당: '🍜',
  카페: '☕',
  쇼핑: '🛍',
  자연: '🌿',
  문화: '🎭',
  호텔: '🏨',
  바: '🍻',
  교통: '🚆',
};

export const STYLE_CHIPS = [
  { emoji: '🍜', label: '맛집 위주', value: '맛집 위주' },
  { emoji: '🏛', label: '문화·관광', value: '문화·역사·관광지 위주' },
  { emoji: '🛍', label: '쇼핑', value: '쇼핑 위주' },
  { emoji: '🌿', label: '자연·힐링', value: '자연·힐링 위주' },
  { emoji: '🎉', label: '액티비티', value: '액티비티·체험 위주' },
  { emoji: '☕', label: '카페 투어', value: '카페 투어 위주' },
];

export const SESSION_KEY = 'planit-ai-chat';

export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getActionPlaceName(place: ChatActionPlace | string): string {
  return typeof place === 'string' ? place : place.name;
}

export function getActionPlaceCategory(place: ChatActionPlace | string): string | null {
  return typeof place === 'string' ? null : place.category ?? null;
}
