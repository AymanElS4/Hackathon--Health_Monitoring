/**
 * CL4 pulse check (T086, RN3, D34): whether today's resting pulse is outside "tu normal". The
 * baseline comes from the first 14 days of `history` (newest first); the last 3 values are today's
 * and the two previous consecutive days'. The result only feeds the reducer's mood re-ask; it is
 * not a verdict and never gives a level.
 */
import type { CheckRecord, Observation } from '@base-vital/contracts';
import type { CheckRepositoryPort, ClockPort } from '../ports';
import { priorChecksOf } from './previousChecks';
import {
  OUTSIDE_NORMAL_READINGS,
  baselineValue,
  computeBaseline,
  consecutiveValues,
  isOutsideNormal,
} from '@base-vital/health-rules';

/** True when `today` (the pulse read of this check-in) is outside normal against `history`. */
export function pulseOutsideNormal(
  history: readonly CheckRecord[],
  today: Observation | undefined,
): boolean {
  const current = baselineValue(today, 'resting_heart_rate');
  if (current === undefined) return false;
  const previous = consecutiveValues(history, 'resting_heart_rate').slice(0, OUTSIDE_NORMAL_READINGS - 1);
  return isOutsideNormal(
    'resting_heart_rate',
    [current, ...previous],
    computeBaseline(history, 'resting_heart_rate'),
  );
}

/**
 * The runner's check: the previous days' checks are read from the repository (newest first); checks
 * saved earlier today are left out. A history that cannot be read gives `false`, so the check-in
 * never waits on it and no re-ask is made.
 */
export async function pulseOutsideNormalOf(
  repository: CheckRepositoryPort,
  clock: ClockPort,
  observations: readonly Observation[],
): Promise<boolean> {
  const history = await priorChecksOf(repository, clock);
  return pulseOutsideNormal(
    history,
    observations.find((observation) => observation.indicator === 'resting_heart_rate'),
  );
}
