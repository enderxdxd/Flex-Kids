import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Tela vazia é convite para agir, não lamento. Sem caixa de ícone gigante:
 * o que interessa é a frase e o botão.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="text-center py-12 px-4">
    <div className="text-ink-300 flex justify-center mb-3" aria-hidden="true">{icon}</div>
    <p className="text-sm font-semibold text-ink-700">{title}</p>
    {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
