import React from 'react';
import { cn } from './cn';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const padMap: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  interactive?: boolean;
  accent?: boolean;
}

export const Card: React.FC<CardProps> = ({
  padding = 'md',
  interactive = false,
  accent = false,
  className,
  children,
  ...rest
}) => (
  <div
    className={cn(
      'relative bg-white/95 backdrop-blur-sm rounded-card-lg border border-slate-200/80 shadow-card',
      padMap[padding],
      interactive && 'transition-all duration-200 hover:shadow-card-hover hover:border-brand-200 hover:-translate-y-0.5',
      accent && 'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-card-lg before:bg-brand-gradient',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export default Card;
