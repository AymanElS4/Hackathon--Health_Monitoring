import type { Level } from '@base-vital/contracts';

/** A body reading as it is drawn: a dot carries the "*" mark only when it has a status label. */
export interface TeamMarkReading {
  level: Level;
  teamCriterion: boolean;
}

export interface TeamNoteInput {
  /** Readings drawn on the screen (body dots). */
  readings: readonly TeamMarkReading[];
  /** Other marked elements on the screen, e.g. the mood chip or the verdict panel. */
  marks?: readonly boolean[];
}

/**
 * Whether a screen must render `team.criterion.note` once (Principle VIII): true when some element
 * on it carries the "*" mark. A green dot has no status label, so it never carries the mark.
 */
export function needsTeamNote({ readings, marks = [] }: TeamNoteInput): boolean {
  const dotMarked = readings.some((reading) => reading.teamCriterion && reading.level !== 'green');
  return dotMarked || marks.some((marked) => marked);
}
