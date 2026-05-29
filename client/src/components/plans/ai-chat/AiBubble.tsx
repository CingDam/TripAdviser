'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// AI 답변 마크다운 렌더링 — Claude/GPT 웹처럼 버블 없는 풀폭 텍스트
// 단락·헤딩·리스트·인라인 코드·인용구·구분선·링크·테이블까지 표준 GFM 세트 지원
// remark-gfm: 테이블·취소선·자동 링크 처리 (AI가 비교표를 낼 때 깨짐 방지)
export default function AiBubble({ text }: { text: string }) {
  return (
    <div className="w-full text-[#0f172a]/80 dark:text-zinc-200 text-[14px] leading-[1.65] tracking-tight space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 첫 단락은 위 여백 제거 — 메시지 상단이 떠 보이지 않게 (space-y-3가 처리)
          p: ({ children }) => <p className="leading-[1.65]">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[#0f172a] dark:text-zinc-100">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => (
            <del className="text-[#0f172a]/45 dark:text-zinc-500">{children}</del>
          ),
          // 헤딩 — 챗봇 맥락이라 큰 차이만 두고 컴팩트하게
          h1: ({ children }) => (
            <h1 className="text-[16px] font-bold text-[#0f172a] dark:text-zinc-100 tracking-tight mt-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-semibold text-[#0f172a] dark:text-zinc-100 tracking-tight mt-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[14px] font-semibold text-[#0f172a] dark:text-zinc-100 tracking-tight">{children}</h3>
          ),
          ul: ({ children }) => <ul className="space-y-1 pl-1 list-none">{children}</ul>,
          ol: ({ children }) => (
            <ol className="space-y-1 pl-5 list-decimal marker:text-[#2563EB]/40 dark:marker:text-zinc-500">{children}</ol>
          ),
          li: ({ children, ...rest }) => {
            const ordered = (rest as { ordered?: boolean }).ordered;
            if (ordered) {
              return <li className="text-[14px] leading-[1.65]">{children}</li>;
            }
            return (
              <li className="flex items-start gap-2 text-[14px] list-none leading-[1.65]">
                <span className="mt-[9px] w-1 h-1 rounded-full bg-[#2563EB]/30 dark:bg-zinc-500 flex-shrink-0" />
                <span className="min-w-0">{children}</span>
              </li>
            );
          },
          // 인라인 코드 — react-markdown v10은 inline 코드와 코드블록 모두 code로 옴
          // 부모가 pre면 코드블록, 아니면 인라인. 여행 챗봇엔 인라인만 사실상 등장
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-white/[0.06] text-[#2563EB] dark:text-[#60A5FA] text-[13px] font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="px-3.5 py-3 rounded-xl bg-[#F8FAFF] dark:bg-white/[0.04] border border-[#DBEAFE] dark:border-white/[0.08] overflow-x-auto text-[13px] leading-relaxed">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#2563EB]/30 dark:border-[#60A5FA]/30 pl-3 text-[#0f172a]/60 dark:text-zinc-400">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2563EB] dark:text-[#60A5FA] underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-[#DBEAFE] dark:border-white/[0.08]" />,
          // 테이블 — AI가 장소 비교표 등을 낼 때 가로 스크롤로 안전하게 렌더
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-xl border border-[#DBEAFE] dark:border-white/[0.08]">
              <table className="w-full text-[13px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#EFF6FF] dark:bg-white/[0.04]">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-[#0f172a] dark:text-zinc-100 border-b border-[#DBEAFE] dark:border-white/[0.08]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-[#DBEAFE]/60 dark:border-white/[0.05] align-top">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
