import type { ReactNode } from 'react';

export interface StatCardProps {
  /** Short name of the measure. */
  label: string;
  /** Formatted measure; always shown in the neutral text color. */
  value: string;
  /** Optional extra content, e.g. a criterion note. */
  children?: ReactNode;
}

/** Labelled measure. The value never takes a level color. */
export function StatCard({ label, value, children }: StatCardProps) {
  return (
    <div className="flex flex-col gap-xs rounded-card bg-card p-lg shadow-ambient">
      <p className="text-meta text-ink-secondary">{label}</p>
      <p className="text-title font-semibold text-ink">{value}</p>
      {children}
    </div>
  );
}
