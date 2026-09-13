import React from 'react';
import { cn } from './cn';

type Variant = 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md';

const variantMap: Record<Variant, string> = {
  ghost: 'hover:bg-ink-100 text-ink-400 hover:text-ink-700',
  outline: 'border border-line hover:border-line-strong hover:bg-ink-100/60 text-ink-500 hover:text-ink-800',
  danger: 'border border-line hover:border-danger-300 hover:bg-danger-50 text-ink-400 hover:text-danger-600',
};

const sizeMap: Record<Size, string> = {
  sm: 'w-7 h-7',
  md: 'w-control h-control',
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
        'inline-flex items-center justify-center rounded-md transition-colors duration-100',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:shadow-focus',
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
