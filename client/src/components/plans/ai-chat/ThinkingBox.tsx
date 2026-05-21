'use client';
import { useState } from 'react';
import { Loader2, Sparkles, ChevronDown, Search, CloudSun, Route, GitCompare, ListChecks, Gauge, Wallet, Wand2, ArrowLeftRight } from 'lucide-react';
import { ThinkingStep } from './types';

function ToolIcon({ tool, size = 11 }: { tool: string; size?: number }) {
  if (tool === 'search_places') return <Search size={size} />;
  if (tool === 'get_weather') return <CloudSun size={size} />;
  if (tool === 'get_directions') return <Route size={size} />;
  if (tool === 'compare_places') return <GitCompare size={size} />;
  if (tool === 'get_trip_context') return <ListChecks size={size} />;
  if (tool === 'evaluate_day_balance') return <Gauge size={size} />;
  if (tool === 'estimate_budget') return <Wallet size={size} />;
  if (tool === 'propose_add_places') return <Wand2 size={size} />;
  if (tool === 'propose_replace_places') return <ArrowLeftRight size={size} />;
  return <Sparkles size={size} />;
}

export default function ThinkingBox({ steps, ms, loading }: { steps: ThinkingStep[]; ms?: number; loading?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (steps.length === 0) return null;

  const summaryText = loading
    ? `${steps.length}개 단계 · 분석 중`
    : `${steps.length}개 단계${ms ? ` · ${(ms / 1000).toFixed(1)}s` : ''}`;

  return (
    <div className="w-full rounded-xl bg-[#EFF6FF]/60 dark:bg-white/[0.03] border border-[#DBEAFE] dark:border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#0f172a]/50 dark:text-zinc-400 hover:bg-[#DBEAFE]/30 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {loading ? (
            <Loader2 size={12} className="animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
          ) : (
            <Sparkles size={12} className="text-[#2563EB] dark:text-[#60A5FA]" />
          )}
          <span className="font-medium tracking-tight">{summaryText}</span>
        </span>
        <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 pt-1.5 space-y-1.5 border-t border-[#DBEAFE] dark:border-white/[0.06]">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs leading-relaxed">
              <span className="mt-0.5 text-[#2563EB]/60 dark:text-[#60A5FA]/60 flex-shrink-0">
                <ToolIcon tool={s.tool} size={12} />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[#0f172a]/70 dark:text-zinc-300">{s.label}</span>
                {s.summary && (
                  <span className={`ml-1.5 ${s.ok === false ? 'text-red-500 dark:text-red-400' : 'text-[#0f172a]/40 dark:text-zinc-500'}`}>
                    · {s.summary}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
