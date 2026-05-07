import React from 'react';
import { cn } from './cn';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  gradient?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  gradient = true,
}) => (
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div className="min-w-0">
      <h1
        className={cn(
          'text-display',
          gradient
            ? 'bg-brand-gradient bg-clip-text text-transparent'
            : 'text-slate-900',
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
