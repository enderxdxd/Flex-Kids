import React from 'react';
import { cn } from './cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  iconLeft?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ invalid, iconLeft, className, ...rest }, ref) => {
    const base = cn(
      'w-full h-control text-sm bg-paper-raised border rounded-md text-ink-900',
      'placeholder:text-ink-400',
      'transition-[border-color] duration-100',
      'focus:outline-none focus-visible:shadow-focus',
      invalid
        ? 'border-danger-300 focus:border-danger-500'
        : 'border-line hover:border-line-strong focus:border-brand-500',
    );

    if (iconLeft) {
      return (
        <div className="relative w-full min-w-0 flex-1">
          <div className="absolute inset-y-0 left-2.5 flex items-center text-ink-400 pointer-events-none" aria-hidden="true">
            {iconLeft}
          </div>
          <input
            ref={ref}
            className={cn(base, 'pl-9 pr-3', className)}
            aria-invalid={invalid || undefined}
            {...rest}
          />
        </div>
      );
    }
    return (
      <input
        ref={ref}
        className={cn(base, 'px-3', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

Input.displayName = 'Input';

export default Input;
