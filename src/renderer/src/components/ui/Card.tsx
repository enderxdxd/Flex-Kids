import React from 'react';
import { cn } from './cn';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const padMap: Record<Padding, string> = {
  none: '',
  sm: 'p-3.5',
  md: 'p-4',
  lg: 'p-5',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  interactive?: boolean;
  accent?: boolean;
}

/**
 * Superfície de conteúdo. Borda define o limite; sombra apenas separa do
 * papel. Sem blur, sem levitar no hover — cartão que se mexe embaixo do
 * cursor atrapalha quem está mirando um botão dentro dele.
 */
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
      'relative bg-paper-raised rounded-card-lg border border-line shadow-card',
      padMap[padding],
      interactive && 'transition-[border-color,box-shadow] duration-100 hover:border-line-strong hover:shadow-card-hover',
      accent && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:rounded-l-card-lg before:bg-brand-500',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export default Card;
