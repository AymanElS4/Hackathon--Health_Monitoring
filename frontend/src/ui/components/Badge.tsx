import type { ReactNode } from 'react';
import type { Level } from '@base-vital/contracts';
import { LEVEL_COLORS } from '../../config/constants';
import { t } from '../../config/messages.es';

export interface BadgeProps {
  /** Level whose color table entry styles the badge. */
  level: Level;
  children: ReactNode;
  /** Adds the team criterion mark (`team.criterion.mark`) after the label. */
  mark?: boolean;
}

/**
 * Text classes per level. Green is slate on a light chip. The other levels use ink text (their
 * colors fail contrast as text at 13 px) and carry the level color in an 8 px marker instead.
 */
const LEVEL_CLASSES: Record<Level, string> = {
  green: 'text-level-green bg-level-green-bg',
  amber: 'text-ink',
  red: 'text-ink',
  in_doubt: 'text-ink',
  unknown: 'text-ink',
};

/** Marker color of a non-green level: its ring color, or its fill for "sin dato" (from `LEVEL_COLORS`). */
function markerColor(level: Exclude<Level, 'green'>): string {
  const entry = LEVEL_COLORS[level];
  return entry.ring ?? entry.fill ?? entry.label;
}

/** Small level label, with an 8 px level marker before the text for every level but green. */
export function Badge({ level, children, mark = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-xs whitespace-nowrap rounded-card px-sm py-xs text-meta font-semibold ${LEVEL_CLASSES[level]}`}
    >
      {level !== 'green' && (
        <span
          aria-hidden="true"
          data-testid="badge-level-marker"
          className="h-levelMarker w-levelMarker shrink-0 rounded-full"
          style={{ backgroundColor: markerColor(level) }}
        />
      )}
      {children}
      {mark && <span>{t('team.criterion.mark')}</span>}
    </span>
  );
}
