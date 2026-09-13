import React from 'react';
import { cn } from './cn';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Mantido por compatibilidade; texto em gradiente saiu do sistema. */
  gradient?: boolean;
}

/**
 * Cabeçalho de tela. O título é tinta sólida: texto em gradiente recortado
 * perde contraste e legibilidade, e não diz nada sobre a tela.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
}) => (
  <div className="flex items-end justify-between gap-4 flex-wrap pb-4 border-b border-line">
    <div className="min-w-0">
      <h1 className={cn('text-display text-ink-900')}>{title}</h1>
      {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
