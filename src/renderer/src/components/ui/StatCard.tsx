import React from 'react';
import { cn } from './cn';

type Tone = 'brand' | 'emerald' | 'amber' | 'blue' | 'slate';

const toneMap: Record<Tone, {
  iconBg: string;
  iconFg: string;
  glow: string;
  ring: string;
  number: string;
}> = {
  brand: {
    iconBg: 'bg-gradient-to-br from-brand-500 to-accent-600',
    iconFg: 'text-white',
    glow: 'before:bg-gradient-to-br before:from-brand-100/80 before:to-transparent',
    ring: 'hover:border-brand-300',
    number: 'text-brand-700',
  },
  emerald: {
    iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-600',
    iconFg: 'text-white',
    glow: 'before:bg-gradient-to-br before:from-emerald-100/80 before:to-transparent',
    ring: 'hover:border-emerald-300',
    number: 'text-emerald-700',
  },
  amber: {
    iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    iconFg: 'text-white',
    glow: 'before:bg-gradient-to-br before:from-amber-100/80 before:to-transparent',
    ring: 'hover:border-amber-300',
    number: 'text-amber-700',
  },
  blue: {
    iconBg: 'bg-gradient-to-br from-sky-400 to-blue-600',
    iconFg: 'text-white',
    glow: 'before:bg-gradient-to-br before:from-blue-100/80 before:to-transparent',
    ring: 'hover:border-blue-300',
    number: 'text-blue-700',
  },
  slate: {
    iconBg: 'bg-gradient-to-br from-slate-400 to-slate-600',
    iconFg: 'text-white',
    glow: 'before:bg-gradient-to-br before:from-slate-100/80 before:to-transparent',
    ring: 'hover:border-slate-300',
    number: 'text-slate-800',
  },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
  hint?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  tone = 'brand',
  loading = false,
  hint,
}) => {
  const t = toneMap[tone];
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-white rounded-card-lg border border-slate-200/80 shadow-card p-5',
        'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5',
        'before:absolute before:inset-0 before:opacity-60 before:pointer-events-none',
        t.glow,
        t.ring,
      )}
    >
      <div className="relative flex items-center justify-between mb-3">
        <div
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center shadow-sm',
            t.iconBg,
            t.iconFg,
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
        {loading && (
          <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>
      <p className="relative text-caption text-slate-500 uppercase">{label}</p>
      <p className={cn('relative text-3xl font-bold mt-1 tabular-nums', t.number)}>{value}</p>
      {hint && <p className="relative text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
};

export default StatCard;
