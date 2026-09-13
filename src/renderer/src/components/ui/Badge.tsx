import React from 'react';
import { cn } from './cn';

type Tone = 'brand' | 'emerald' | 'amber' | 'orange' | 'red' | 'blue' | 'slate';
type Size = 'sm' | 'md';

/**
 * Etiqueta de estado. Fundo lavado e texto forte: precisa ser lida de
 * relance numa lista, sem roubar o lugar do nome ao lado.
 */
const toneMap: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  emerald: 'bg-state-ok-soft text-state-ok ring-state-ok/25',
  amber: 'bg-state-warn-soft text-state-warn ring-state-warn/25',
  orange: 'bg-state-warn-soft text-state-warn ring-state-warn/25',
  red: 'bg-state-bad-soft text-state-bad ring-state-bad/25',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  slate: 'bg-ink-100 text-ink-600 ring-ink-200',
};

const sizeMap: Record<Size, string> = {
  sm: 'text-[10px] leading-4 px-1.5',
  md: 'text-[11px] leading-5 px-2',
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
      'inline-flex items-center gap-1 rounded font-semibold tracking-wide ring-1 ring-inset',
      toneMap[tone],
      sizeMap[size],
      className,
    )}
  >
    {children}
  </span>
);

export default Badge;
