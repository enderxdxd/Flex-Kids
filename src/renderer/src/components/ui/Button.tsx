import React from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

/**
 * Só o primário carrega cor cheia. Se todo botão da tela for colorido,
 * nenhum é a ação principal e o funcionário perde tempo procurando.
 */
const variantMap: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-brand-sm hover:brightness-[1.08] active:brightness-95 disabled:opacity-50 disabled:shadow-none',
  secondary:
    'bg-ink-100 hover:bg-ink-200 text-ink-800 disabled:text-ink-400',
  ghost:
    'bg-transparent hover:bg-ink-100 text-ink-600 hover:text-ink-900 disabled:text-ink-300',
  danger:
    'bg-danger-500 hover:bg-danger-600 active:bg-danger-700 text-white disabled:opacity-50',
  outline:
    'bg-paper-raised hover:bg-ink-100/60 text-ink-700 border border-line hover:border-line-strong disabled:text-ink-300',
};

const sizeMap: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-control px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[0.9375rem] gap-2',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold whitespace-nowrap',
        'transition-[background-color,border-color,filter,box-shadow] duration-100',
        'disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:shadow-focus',
        variantMap[variant],
        sizeMap[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : iconLeft}
      {children}
      {iconRight}
    </button>
  ),
);

Button.displayName = 'Button';

export default Button;
