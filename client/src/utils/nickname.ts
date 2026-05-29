// 닉네임 자동 생성 — 형용사 + 명사 + 2자리 숫자 조합
// 서버가 닉네임 unique를 강제하므로, 중복 시 사용자가 버튼을 다시 눌러 재생성한다
// (숫자 100가지 × 조합 수로 충돌 확률이 낮아 클라이언트 단순 랜덤으로 충분)

const ADJECTIVES = [
  '여행하는', '설레는', '느긋한', '바람부는', '햇살가득', '구름위',
  '별빛나는', '파도치는', '길떠난', '꿈꾸는', '자유로운', '포근한',
];

const NOUNS = [
  '판다', '여우', '고래', '나그네', '펭귄', '두루미',
  '수달', '청솔모', '돌고래', '부엉이', '치타', '라쿤',
];

const NICKNAME_MAX = 15; // tb_user.name 길이 제한과 동일

export function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100); // 0~99
  return `${adj}${noun}${num}`.slice(0, NICKNAME_MAX);
}
