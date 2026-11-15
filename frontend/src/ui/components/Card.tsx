import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  /** Extra layout classes (e.g. `flex-1` inside a stretched column). */
  className?: string;
}

/** Neutral surface for grouping content. */
export function Card({ children, className = '' }: CardProps) {
  return <div className={`rounded-card bg-card p-lg shadow-ambient ${className}`}>{children}</div>;
}
