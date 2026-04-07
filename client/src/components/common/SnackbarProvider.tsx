'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type SnackbarType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: SnackbarType;
  leaving: boolean; // true이면 slide-out 애니메이션 실행 중
}

interface SnackbarContextValue {
  show: (message: string, type?: SnackbarType) => void;
}

const SnackbarContext = createContext<SnackbarContextValue>({ show: () => {} });

export const useSnackbar = () => useContext(SnackbarContext);

// 타입별 아이콘 / 색상 토큰
const STYLES: Record<SnackbarType, {
  icon: React.ReactNode;
  bar: string;        // 진행 바 색상
  iconBg: string;     // 아이콘 배경
}> = {
  success: {
    icon:   <CheckCircle2 size={18} strokeWidth={2} />,
    bar:    'bg-emerald-500',
    iconBg: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/15',
  },
  error: {
    icon:   <XCircle size={18} strokeWidth={2} />,
    bar:    'bg-red-500',
    iconBg: 'text-red-500 bg-red-50 dark:bg-red-500/15',
  },
  warning: {
    icon:   <AlertTriangle size={18} strokeWidth={2} />,
    bar:    'bg-amber-400',
    iconBg: 'text-amber-500 bg-amber-50 dark:bg-amber-500/15',
  },
  info: {
    icon:   <Info size={18} strokeWidth={2} />,
    bar:    'bg-indigo-500',
    iconBg: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/15',
  },
};

const DISMISS_DELAY = 3500; // ms

let _id = 0;

// 개별 토스트 — leaving 상태가 되면 fade-out 후 부모에서 제거
const Toast = ({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) => {
  const s = STYLES[item.type];

  return (
    <div
      className={`
        relative flex items-start gap-3 w-80
        bg-white dark:bg-[#2c2c2e]
        border border-gray-100 dark:border-white/10
        rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/40
        overflow-hidden
        ${item.leaving ? 'animate-toast-out' : 'animate-toast-in'}
      `}
    >
      {/* 본문 */}
      <div className="flex items-start gap-3 p-4 flex-1 min-w-0">
        {/* 아이콘 */}
        <span className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${s.iconBg}`}>
          {s.icon}
        </span>

        {/* 메시지 */}
        <p className="flex-1 text-sm font-medium text-gray-800 dark:text-white/85 leading-snug pt-1">
          {item.message}
        </p>
      </div>

      {/* 닫기 버튼 */}
      <button
        onClick={() => onDismiss(item.id)}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 dark:text-white/25 hover:text-gray-500 dark:hover:text-white/50 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors cursor-pointer"
      >
        <X size={13} strokeWidth={2.5} />
      </button>

      {/* 하단 진행 바 */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${s.bar} opacity-60 animate-toast-progress`} />
    </div>
  );
};

export const SnackbarProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    // leaving 플래그 → 0.28s 후 실제 제거
    setItems((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 280);
  }, []);

  const show = useCallback((message: string, type: SnackbarType = 'info') => {
    const id = ++_id;
    setItems((prev) => [...prev, { id, message, type, leaving: false }]);

    // DISMISS_DELAY 후 자동 slide-out
    setTimeout(() => dismiss(id), DISMISS_DELAY);
  }, [dismiss]);

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}

      {/* 우측 상단 토스트 스택 */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none">
        {items.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <Toast item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  );
};
