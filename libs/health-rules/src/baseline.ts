import type {
  Baseline,
  BaselineIndicator,
  CheckRecord,
  Indicator,
  Observation,
} from '@base-vital/contracts';
import {
  BASELINE_DAYS,
  MIN_SD,
  OUTSIDE_NORMAL_READINGS,
  OUTSIDE_NORMAL_SD,
} from './constants';

/** The check-in observation that carries a baseline indicator (blood pressure carries two). */
const CARRIER: Record<BaselineIndicator, Indicator> = {
  sleep_hours: 'sleep_hours',
  mood: 'mood',
  resting_heart_rate: 'resting_heart_rate',
  systolic: 'blood_pressure',
  diastolic: 'blood_pressure',
  body_temperature: 'body_temperature',
  oxygen_saturation: 'oxygen_saturation',
};

/** The check-in observation indicator that carries a baseline indicator. */
export function carrierOf(indicator: BaselineIndicator): Indicator {
  return CARRIER[indicator];
}

/** Baseline indicators carried by each indicator (RN3: systolic and diastolic are separate). */
export function baselineIndicatorsOf(indicator: Indicator): BaselineIndicator[] {
  return indicator === 'blood_pressure'
    ? ['systolic', 'diastolic']
    : [indicator as BaselineIndicator];
}

/** The numeric value of `indicator` in `observation`, or `undefined` when it carries none. */
export function baselineValue(
  observation: Observation | undefined,
  indicator: BaselineIndicator,
): number | undefined {
  if (observation === undefined || observation.indicator !== CARRIER[indicator]) return undefined;
  const { value } = observation;
  if (indicator === 'systolic' || indicator === 'diastolic') {
    return typeof value === 'object' ? value[indicator] : undefined;
  }
  return typeof value === 'number' ? value : undefined;
}

/** Last observation of `indicator` in one stored check-in; a later one wins. */
function observationIn(record: CheckRecord, indicator: BaselineIndicator): Observation | undefined {
  let found: Observation | undefined;
  for (const observation of record.observations) {
    if (observation.indicator === CARRIER[indicator]) found = observation;
  }
  return found;
}

/**
 * Previous days' values of `indicator`, newest first. Stops at the first day without a numeric
 * value, so the values are consecutive days (RN3, "3 lecturas seguidas").
 */
export function consecutiveValues(
  history: readonly CheckRecord[],
  indicator: BaselineIndicator,
): number[] {
  const values: number[] = [];
  for (const record of history) {
    const value = baselineValue(observationIn(record, indicator), indicator);
    if (value === undefined) break;
    values.push(value);
  }
  return values;
}

/**
 * Personal baseline ("tu normal", RN3) of one indicator, from the first 14 days only.
 *
 * `history` is newest first, so the window is its last 14 records (the oldest). Days after the
 * window do not change the result. `sd` is the population SD floored at `MIN_SD`. Fewer than 14
 * days, or no value in the window, gives `ready: false` and placeholder `mean`/`sd`.
 */
export function computeBaseline(
  history: readonly CheckRecord[],
  indicator: BaselineIndicator,
): Baseline {
  const floor = MIN_SD[indicator];
  if (history.length < BASELINE_DAYS) {
    return { indicator, mean: 0, sd: floor, ready: false };
  }
  const values: number[] = [];
  for (const record of history.slice(-BASELINE_DAYS)) {
    const value = baselineValue(observationIn(record, indicator), indicator);
    if (value !== undefined) values.push(value);
  }
  if (values.length === 0) {
    return { indicator, mean: 0, sd: floor, ready: false };
  }
  // Mean of the offsets from the first value: identical values give exactly that value (no float drift).
  const origin = values[0];
  const mean = origin + values.reduce((sum, value) => sum + (value - origin), 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length;
  return { indicator, mean, sd: Math.max(Math.sqrt(variance), floor), ready: true };
}

/**
 * RN3 outside normal: every one of the last 3 values (newest first, today included) is more than
 * 2 SD from the baseline mean. Strictly greater, so exactly 2 SD is not outside. Never true for a
 * baseline that is not ready, for another indicator's baseline, or with fewer than 3 values.
 */
export function isOutsideNormal(
  indicator: BaselineIndicator,
  last3: readonly number[],
  baseline: Baseline,
): boolean {
  if (!baseline.ready || baseline.indicator !== indicator) return false;
  const recent = last3.slice(0, OUTSIDE_NORMAL_READINGS);
  if (recent.length < OUTSIDE_NORMAL_READINGS) return false;
  const limit = OUTSIDE_NORMAL_SD * baseline.sd;
  return recent.every((value) => Math.abs(value - baseline.mean) > limit);
}
