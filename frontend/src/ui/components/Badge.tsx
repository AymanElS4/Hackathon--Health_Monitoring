import type { ReactNode } from 'react';
import type { Level } from '@base-vital/contracts';
import { t } from '../../config/messages.es';

export interface BadgeProps {
  /** Level whose color table entry styles the label. */
  level: Level;
  children: ReactNode;
  /** Adds the team criterion mark (`team.criterion.mark`) after the label. */
  mark?: boolean;
}

/** Label classes per level, built from the `LEVEL_COLORS` tokens. Green is slate on a light chip, never primary. */
const LEVEL_CLASSES: Record<Level, string> = {
  green: 'text-level-green bg-level-green-bg',
  amber: 'text-level-amber',
  red: 'text-level-red',
  in_doubt: 'text-level-in_doubt',
  unknown: 'text-level-unknown',
};

/** Small level label. */
export function Badge({ level, children, mark = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-card px-sm py-xs text-meta font-semibold ${LEVEL_CLASSES[level]}`}
    >
      {children}
      {mark && <span>{t('team.criterion.mark')}</span>}
    </span>
  );
}
