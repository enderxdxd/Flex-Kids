import React from 'react';
import { cn } from './cn';

export type ClockState = 'quiet' | 'watch' | 'over';

/** 2h e 3h: os mesmos limites que a operação já usava para "visita longa". */
const WATCH_AFTER_MIN = 120;
const OVER_AFTER_MIN = 180;

/**
 * Estado de uma permanência.
 *
 * Abaixo de 2h não recebe cor de propósito — é onde está a maioria das
 * visitas e não pede nada de ninguém. Colorir o normal faz a lista virar
 * vitral e some com o destaque de quem realmente precisa de atenção.
 */
export function clockState(minutes: number): ClockState {
  if (minutes >= OVER_AFTER_MIN) return 'over';
  if (minutes >= WATCH_AFTER_MIN) return 'watch';
  return 'quiet';
}

const textTone: Record<ClockState, string> = {
  quiet: 'text-ink-800',
  watch: 'text-clock-watch',
  over: 'text-clock-over',
};

const stripeTone: Record<ClockState, string> = {
  quiet: 'bg-ink-300',
  watch: 'bg-clock-watch',
  over: 'bg-clock-over',
};

/** Faixa vertical de estado no início de uma linha de lista. */
export const ClockStripe: React.FC<{ minutes: number; className?: string }> = ({ minutes, className }) => (
  <span
    className={cn('block w-[3px] rounded-full', stripeTone[clockState(minutes)], className)}
    aria-hidden="true"
  />
);

/** `137` → `2h17`. Zero à esquerda para os minutos alinharem em coluna. */
export function formatClock(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

interface ClockProps {
  minutes: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-readout-sm',
};

/**
 * Leitura de permanência. Mono tabular para que os tempos empilhados
 * alinhem algarismo a algarismo — a lista de quem está dentro se lê como
 * painel de embarque, que é exatamente o que ela é.
 */
export const Clock: React.FC<ClockProps> = ({ minutes, size = 'md', className }) => (
  <span
    className={cn('font-mono font-medium tracking-tight', sizeMap[size], textTone[clockState(minutes)], className)}
    title={`${Math.max(0, Math.floor(minutes))} minutos`}
  >
    {formatClock(minutes)}
  </span>
);

export default Clock;
