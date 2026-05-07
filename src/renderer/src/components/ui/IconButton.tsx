import React from 'react';
import { cn } from './cn';

type Variant = 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md';

const variantMap: Record<Variant, string> = {
  ghost: 'hover:bg-slate-100 text-slate-500 hover:text-slate-700',
  outline:
    'border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 hover:text-slate-700',
  danger:
    'border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-400 hover:text-red-600',
};

const sizeMap: Record<Size, string> = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'ghost', size = 'md', className, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantMap[variant],
        sizeMap[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = 'IconButton';

export default IconButton;
