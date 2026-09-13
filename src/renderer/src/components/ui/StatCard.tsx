import React from 'react';
import { cn } from './cn';

type Tone = 'brand' | 'emerald' | 'amber' | 'blue' | 'slate';

/**
 * Só o número recebe cor, e só quando a cor significa algo (dinheiro que
 * entrou, pacote, alerta). O ícone virou marca discreta: numa fileira de
 * quatro indicadores, quatro azulejos em gradiente disputam atenção com o
 * dado que o funcionário veio ler.
 */
const numberTone: Record<Tone, string> = {
  brand: 'text-brand-700',
  emerald: 'text-money-in',
  amber: 'text-money-due',
  blue: 'text-sky-700',
  slate: 'text-ink-900',
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
  tone = 'slate',
  loading = false,
  hint,
}) => (
  <div className="bg-paper-raised rounded-card-lg border border-line shadow-card px-4 py-3.5">
    <div className="flex items-center gap-2 text-ink-400">
      <span className="[&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden="true">{icon}</span>
      <p className="text-caption uppercase text-ink-500">{label}</p>
      {loading && (
        <svg className="w-3 h-3 animate-spin ml-auto text-ink-300" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
    </div>
    <p className={cn('text-readout mt-1.5', numberTone[tone])}>{value}</p>
    {hint && <p className="text-xs text-ink-500 mt-0.5">{hint}</p>}
  </div>
);

export default StatCard;
