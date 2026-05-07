import React from 'react';
import { cn } from './cn';

type Tone = 'brand' | 'emerald' | 'amber' | 'orange' | 'red' | 'blue' | 'slate';
type Size = 'sm' | 'md';

const toneMap: Record<Tone, string> = {
  brand: 'bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-200/60',
  emerald: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200/60',
  amber: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/60',
  orange: 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200/60',
  red: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200/60',
  blue: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200/60',
  slate: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/60',
};

const sizeMap: Record<Size, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
};

interface BadgeProps {
  tone?: Tone;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = 'slate',
  size = 'md',
  className,
  children,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full font-semibold',
      toneMap[tone],
      sizeMap[size],
      className,
    )}
  >
    {children}
  </span>
);

export default Badge;
