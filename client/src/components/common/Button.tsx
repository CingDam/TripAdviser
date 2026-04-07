'use client';
import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// variant별 스타일 — 라이트/다크 모드 통일 기준
// primary: 주요 액션 (저장, 검색, 추가)
// secondary: 보조 액션
// ghost: 최소 강조 (취소, 닫기)
// danger: 삭제·초기화
const VARIANT_STYLES: Record<Variant, string> = {
  primary:   'bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-700',
  secondary: 'border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/8',
  ghost:     'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-white/30 dark:hover:text-white/70 dark:hover:bg-white/8',
  danger:    'border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 dark:border-white/10 dark:text-white/40 dark:hover:border-red-500/40 dark:hover:text-red-400',
};

const SIZE_STYLES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-5 py-2.5 text-sm rounded-xl',
};

const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) => (
  <button
    disabled={disabled}
    className={`
      inline-flex items-center justify-center gap-1.5 font-semibold
      transition-all active:scale-95 cursor-pointer
      disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
      ${VARIANT_STYLES[variant]}
      ${SIZE_STYLES[size]}
      ${className}
    `}
    {...props}
  >
    {children}
  </button>
);

export default Button;
