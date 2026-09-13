import React from 'react';
import { cn } from './cn';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={cn('relative overflow-hidden bg-ink-100 rounded-md', className)} aria-hidden="true">
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
  </div>
);

export default Skeleton;
