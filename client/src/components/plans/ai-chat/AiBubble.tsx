'use client';
import ReactMarkdown from 'react-markdown';

export default function AiBubble({ text }: { text: string }) {
  return (
    <div className="w-full text-[#0f172a]/80 dark:text-zinc-200 text-[14px] leading-[1.65] tracking-tight">
      <ReactMarkdown
        components={{
          strong: ({ children }) => (
            <strong className="font-semibold text-[#0f172a] dark:text-zinc-100">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="mt-2 space-y-1 pl-1 list-none">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-2 space-y-1 pl-5 list-decimal marker:text-[#2563EB]/40 dark:marker:text-zinc-500">{children}</ol>
          ),
          li: ({ children, ...rest }) => {
            const ordered = (rest as { ordered?: boolean }).ordered;
            if (ordered) {
              return <li className="text-[14px] leading-[1.65]">{children}</li>;
            }
            return (
              <li className="flex items-start gap-2 text-[14px] list-none leading-[1.65]">
                <span className="mt-[9px] w-1 h-1 rounded-full bg-[#2563EB]/30 dark:bg-zinc-500 flex-shrink-0" />
                <span>{children}</span>
              </li>
            );
          },
          p: ({ children }) => <p className="leading-[1.65]">{children}</p>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
