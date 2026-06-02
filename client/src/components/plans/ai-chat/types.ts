export type ChatActionPlace = { name: string; category?: string | null };

// 전체 일정 자동생성 제안 — generate_full_itinerary tool 결과. [생성] 버튼 클릭 시 runFullGenerate 실행
export interface GenerateAction {
  city: string;
  day_cities?: Record<string, string>;
  style?: string | null;
  // 사용자가 꼭 가고 싶다고 언급한 장소·랜드마크·세부지역 — 자동생성 일정에 강제 포함
  must_visit?: string[];
  // 이미 채워진 날 중 다시 짤 날짜(YYYY-MM-DD) — [생성] 시 기존 일반 장소를 비우고 재생성
  regenerate_dates?: string[];
}

export interface ChatAction {
  places: (ChatActionPlace | string)[];
  target_date?: string | null;
  remove_names?: string[];
  // Agent가 conversation_city로 장소를 찾은 경우 — props.city와 다를 수 있으므로 resolve 시 이 도시 사용
  city?: string | null;
  // 있으면 장소 추가가 아닌 전체 일정 자동생성 제안 — ActionCard 대신 생성 확인 카드 표시
  generate?: GenerateAction | null;
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
  // 자동생성 등 장시간 작업의 진행 중 메시지 — 텍스트가 있어도 타이핑 점을 함께 표시
  isPending?: boolean;
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
