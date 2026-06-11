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
  // 자동생성 진행률 — 채울 날짜 수 기준. 있으면 진행 중 메시지 아래 막대 바 표시
  progress?: { current: number; total: number };
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

// 챗봇 대화 sessionStorage 키 — 일정 단위로 분리한다.
// 고정 키를 쓰면 같은 도시의 다른 일정(저장 안 한 새 일정 포함)에 들어가도 이전 대화가 복원된다.
// 수정 모드는 planNum, 신규는 도시명으로 구분 → 일정이 다르면 키가 달라 자연히 복원 안 됨.
const SESSION_KEY_PREFIX = 'planit-ai-chat';

export function chatSessionKey(planNum: number | null, city: string): string {
  return planNum != null ? `${SESSION_KEY_PREFIX}:edit:${planNum}` : `${SESSION_KEY_PREFIX}:new:${city}`;
}

// 모든 챗봇 대화 키를 일괄 제거 — 새 일정 진입·이탈 시 잔존 대화 정리용
export function clearAllChatSessions(): void {
  if (typeof window === 'undefined') return;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(SESSION_KEY_PREFIX)) sessionStorage.removeItem(key);
  }
}

export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 자동생성 진행 표시용 날짜 라벨 — 절대 'N일차'만 쓰면 마지막날만 재생성 시 '4일차'가
// 앞 일차 없이 홀로 떠 어색하다. 첫날·마지막날은 상대 표현, 중간날은 'N일차(MM/DD)'로 날짜 병기
export function relativeDayLabel(date: string, allDates: string[]): string {
  const idx = allDates.indexOf(date);
  const md = date.slice(5).replace('-', '/'); // YYYY-MM-DD → MM/DD
  if (idx === 0) return `첫날(${md})`;
  if (idx === allDates.length - 1) return `마지막날(${md})`;
  return `${idx + 1}일차(${md})`;
}

export function getActionPlaceName(place: ChatActionPlace | string): string {
  return typeof place === 'string' ? place : place.name;
}

export function getActionPlaceCategory(place: ChatActionPlace | string): string | null {
  return typeof place === 'string' ? null : place.category ?? null;
}
