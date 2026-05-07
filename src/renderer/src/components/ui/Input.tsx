import React from 'react';
import { cn } from './cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  iconLeft?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ invalid, iconLeft, className, ...rest }, ref) => {
    const base = cn(
      'w-full h-10 text-sm bg-white border rounded-lg',
      'placeholder:text-slate-400',
      'transition-all duration-150',
      'shadow-sm hover:shadow-card',
      invalid
        ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
        : 'border-slate-200 hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
      'focus:outline-none',
    );

    if (iconLeft) {
      return (
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none" aria-hidden="true">
            {iconLeft}
          </div>
          <input
            ref={ref}
            className={cn(base, 'pl-10 pr-3', className)}
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
