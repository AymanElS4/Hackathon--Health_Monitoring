/**
 * Pure mission clock. No I/O and no config imports: every calendar value
 * (phase lengths, cycle offset) is a parameter supplied by the caller.
 *
 * Days are compared by local calendar date (the crew's clock, FR-014), so the time of day is ignored.
 */

/** 24 h × 60 min × 60 s × 1000 ms. */
const MS_PER_DAY = 86400000;

export interface LightPhase {
  kind: 'light' | 'dark';
  /** 1-based day within the current phase. */
  day: number;
  /** Length of the current phase in days. */
  of: number;
}

/** Local calendar day of `d`, as a whole number of days since the Unix epoch. */
function localDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY);
}

/**
 * Mission day for `now`: whole local calendar days since `start` plus 1, so the start date is day 1.
 * Dates before `start` are clamped to day 1.
 */
export function missionDay(start: Date, now: Date): number {
  const elapsed = localDayNumber(now) - localDayNumber(start);
  return Math.max(elapsed, 0) + 1;
}

/**
 * Position of `now` in a repeating cycle of `lightDays` light days followed by
 * `darkDays` dark days.
 *
 * `offsetDays` is how far into the cycle mission day 1 sits (0 means day 1 is
 * light day 1). Dates before `start` are clamped to day 1 via `missionDay`.
 */
export function lightPhase(
  start: Date,
  now: Date,
  lightDays: number,
  darkDays: number,
  offsetDays = 0,
): LightPhase {
  const cycle = lightDays + darkDays;
  const raw = missionDay(start, now) - 1 + offsetDays;
  const index = ((raw % cycle) + cycle) % cycle;

  if (index < lightDays) {
    return { kind: 'light', day: index + 1, of: lightDays };
  }
  return { kind: 'dark', day: index - lightDays + 1, of: darkDays };
}
