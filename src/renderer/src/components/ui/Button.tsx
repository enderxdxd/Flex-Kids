import React from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variantMap: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-brand-sm hover:shadow-brand hover:brightness-110 disabled:opacity-60',
  secondary:
    'bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:text-slate-400',
  ghost:
    'bg-transparent hover:bg-brand-50 text-slate-700 hover:text-brand-700 disabled:text-slate-400',
  danger:
    'bg-gradient-to-br from-red-500 to-rose-600 hover:brightness-110 text-white shadow-card disabled:opacity-60',
  outline:
    'bg-white hover:bg-brand-50 text-slate-700 hover:text-brand-700 border border-slate-200 hover:border-brand-300 disabled:text-slate-400',
};

const sizeMap: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
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
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
        'transition-all duration-150 active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        variantMap[variant],
        sizeMap[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
