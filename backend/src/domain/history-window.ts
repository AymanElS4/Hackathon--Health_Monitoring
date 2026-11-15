import { HISTORY_DAYS, MS_PER_DAY } from '../config/constants';

/** Start of the UTC calendar day containing `epochMs`, in epoch milliseconds. */
function startOfUtcDayMs(epochMs: number): number {
  const date = new Date(epochMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Calendar window of the surgeon's crew history: `days` UTC days ending on the UTC day of the
 * latest check. `to` is exclusive (start of the day after the latest check's day); `from` is
 * inclusive.
 */
export function historyWindow(
  latestCompletedAt: string,
  days = HISTORY_DAYS,
): { from: string; to: string } {
  const to = startOfUtcDayMs(Date.parse(latestCompletedAt)) + MS_PER_DAY;
  const from = to - days * MS_PER_DAY;
  return {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
  };
}
