import React from 'react';
import { cn } from './cn';

interface SectionHeaderProps {
  title: string;
  count?: number;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho de painel. Rótulo em caixa alta espaçada — lê como etiqueta de
 * instrumento e não compete com os nomes dentro da lista.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, count, actions, className }) => (
  <div className={cn('flex items-center justify-between gap-3 px-4 h-11 border-b border-line', className)}>
    <div className="flex items-baseline gap-2 min-w-0">
      <h2 className="text-caption uppercase text-ink-500 truncate">{title}</h2>
      {count !== undefined && (
        <span className="text-caption text-ink-400 tabular-nums">{count}</span>
      )}
    </div>
    {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
  </div>
);

export default SectionHeader;
