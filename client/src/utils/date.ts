// ISO 문자열 → 'YYYY.MM.DD HH:mm' — 커뮤니티 게시글·댓글 작성 시각 표시용
export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
