import type { ReactNode } from 'react';

export interface CardHeaderProps {
  /** Card label; shown uppercase through CSS. */
  label: string;
  /** Optional right-hand element (a chip or a disabled link). */
  trailing?: ReactNode;
}

/** Label row of a Home card with a bottom divider. */
export function CardHeader({ label, trailing }: CardHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-md border-b border-track pb-md">
      <h2 className="text-label font-semibold uppercase text-ink-secondary">{label}</h2>
      {trailing}
    </header>
  );
}
