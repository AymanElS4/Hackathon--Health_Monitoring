/**
 * RN3 personal baseline ("tu normal") checks (T081). Implemented in T085, `src/baseline.ts`.
 *
 * Expected API:
 *
 *   computeBaseline(history: readonly CheckRecord[], indicator: BaselineIndicator): Baseline
 *     - `history` is newest first (same order as `EvaluateInput.history`).
 *     - The window is the first 14 days: the 14 OLDEST records. Days after it never change the
 *       result, so the baseline is fixed once day 14 exists.
 *     - `mean` and `sd` are the population mean and population SD of the numeric values of
 *       `indicator` in the window. `sd = max(computed, MIN_SD[indicator])`, never 0.
 *     - Blood pressure: `systolic` and `diastolic` are separate indicators and separate baselines.
 *     - `ready` is `true` when the history has at least 14 days and the window holds a value of
 *       the indicator. Otherwise `false` (UI: "Aún aprendo tu normal", CL3). When `ready` is false,
 *       `mean` and `sd` are placeholders and must not be shown.
 *
 *   isOutsideNormal(
 *     indicator: BaselineIndicator,
 *     last3: readonly number[], // the last 3 check-ins' values, newest first, current one included
 *     baseline: Baseline,
 *   ): boolean
 *
 * Outside-normal rule (RN3): a value is outside normal when it is more than 2 SD away from the
 * mean, i.e. `|value - mean| > 2 * sd`, and that holds for ALL of the last 3 readings. The
 * direction does not matter. Strictly greater: exactly 2 SD is not outside. A baseline that is
 * not `ready`, or fewer than 3 readings, is never outside normal.
 * TEAM CRITERION, not clinical (Principle VIII): RN3 gives the 2 SD and the 3-reading count; no
 * guideline sets them. Shown as "criterio del equipo, no clínico" when it sets an action.
 *
 * `evaluateCheck` (T085) computes `last3` as the current value followed by the previous two
 * values of the indicator from `history`, and sets `outsideNormal` on the reading.
 */
import { describe, it, expect } from 'vitest';
import {
  BaselineIndicator,
  CheckRecord,
  SensorKey,
  type Observation,
  type SensorReading,
} from '@base-vital/contracts';
import { computeBaseline, isOutsideNormal } from '../src/baseline';
import { MIN_SD } from '../src/constants';
import { evaluateCheck } from '../src/evaluateCheck';

/** Length of the baseline window in days (RN3). */
const BASELINE_DAYS = 14;

/** Values of one day, per indicator. Blood pressure is systolic and diastolic together. */
type DayValues = Partial<Record<BaselineIndicator, number>>;

/** Sensor readings a stored record needs; the baseline does not read them. */
const READINGS = Object.fromEntries(
  SensorKey.options.map((sensor) => [
    sensor,
    {
      sensor,
      level: 'green',
      phase: 'confirmed',
      value: '',
      outsideNormal: false,
      teamCriterion: false,
      reason: null,
    } satisfies SensorReading,
  ]),
) as Record<SensorKey, SensorReading>;

/** Day `index` of the fixture calendar (October 2026), so later indexes are later days. */
const dayAt = (index: number) => new Date(Date.UTC(2026, 9, 1 + index)).toISOString();

/** A stored check-in for day `index` with the given values, built through the contracts schema. */
function recordOf(index: number, values: DayValues): CheckRecord {
  const at = dayAt(index);
  const observations: unknown[] = [];
  if (values.sleep_hours !== undefined) {
    observations.push({ indicator: 'sleep_hours', value: values.sleep_hours, source: 'voice', confirmed: true, simulated: false, at });
  }
  if (values.mood !== undefined) {
    observations.push({ indicator: 'mood', value: values.mood, source: 'voice', confirmed: true, simulated: false, at });
  }
  if (values.systolic !== undefined && values.diastolic !== undefined) {
    observations.push({
      indicator: 'blood_pressure',
      value: { systolic: values.systolic, diastolic: values.diastolic },
      source: 'device',
      confirmed: true,
      simulated: true,
      at,
    });
  }
  const devicePairs = [
    ['resting_heart_rate', values.resting_heart_rate],
    ['body_temperature', values.body_temperature],
    ['oxygen_saturation', values.oxygen_saturation],
  ] as const;
  for (const [indicator, value] of devicePairs) {
    if (value !== undefined) {
      observations.push({ indicator, value, source: 'device', confirmed: true, simulated: true, at });
    }
  }
  return CheckRecord.parse({
    id: at,
    observations,
    symptoms: [],
    readings: READINGS,
    verdict: 'ok',
    actionKey: '',
    simulated: true,
  });
}

/**
 * One indicator's values per day, oldest first. Blood pressure fills the other component with a
 * fixed filler (diastolic 80 for systolic, systolic 120 for diastolic) so each day is a full reading.
 */
function seriesOf(indicator: BaselineIndicator, values: readonly number[]): DayValues[] {
  return values.map((value) => {
    if (indicator === 'systolic') return { systolic: value, diastolic: 80 };
    if (indicator === 'diastolic') return { systolic: 120, diastolic: value };
    return { [indicator]: value };
  });
}

/** Day values (oldest first) to history records, newest first, as `evaluateCheck` takes it. */
function historyOf(days: readonly DayValues[]): CheckRecord[] {
  return days.map((values, index) => recordOf(index, values)).reverse();
}

/** `count` values alternating `mean - spread` and `mean + spread`: population SD = spread. */
function alternating(mean: number, spread: number, count = BASELINE_DAYS): number[] {
  return Array.from({ length: count }, (_, index) => (index % 2 === 0 ? mean - spread : mean + spread));
}

function constant(value: number, count = BASELINE_DAYS): number[] {
  return Array.from({ length: count }, () => value);
}

/** Constant value of every indicator, for the 14-identical-values cases. */
const IDENTICAL: Record<BaselineIndicator, number> = {
  sleep_hours: 7.5,
  mood: 4,
  resting_heart_rate: 70,
  systolic: 118,
  diastolic: 76,
  body_temperature: 36.8,
  oxygen_saturation: 97,
};

/**
 * One step: the smallest change a reading can show. Temperature is read to 0.1 °C (one decimal,
 * see thresholds.ts), so its step is 0.1 and not 1 (1 °C would be far outside a 0.2 SD).
 */
const ONE_STEP: Record<BaselineIndicator, number> = {
  sleep_hours: 1,
  mood: 1,
  resting_heart_rate: 1,
  systolic: 1,
  diastolic: 1,
  body_temperature: 0.1,
  oxygen_saturation: 1,
};

describe('computeBaseline (RN3)', () => {
  it('uses the first 14 days: mean 62 and SD 3 from values alternating 59 and 65', () => {
    const baseline = computeBaseline(
      historyOf(seriesOf('resting_heart_rate', alternating(62, 3))),
      'resting_heart_rate',
    );

    expect(baseline.indicator).toBe('resting_heart_rate');
    expect(baseline.ready).toBe(true);
    expect(baseline.mean).toBe(62);
    expect(baseline.sd).toBe(3);
  });

  it('is fixed after day 14: days 15 and later do not change mean or sd', () => {
    const first14 = seriesOf('resting_heart_rate', alternating(62, 3));
    const fixed = computeBaseline(historyOf(first14), 'resting_heart_rate');

    const later = computeBaseline(
      historyOf([...first14, ...seriesOf('resting_heart_rate', [72, 72, 72, 200, 40])]),
      'resting_heart_rate',
    );

    expect(later).toEqual(fixed);
  });

  it.each([0, 1, 13])('is not ready with %i days of history (fewer than 14)', (days) => {
    const baseline = computeBaseline(
      historyOf(seriesOf('resting_heart_rate', alternating(62, 3, days))),
      'resting_heart_rate',
    );

    expect(baseline.ready).toBe(false);
  });

  it('is ready with exactly 14 days of history', () => {
    const baseline = computeBaseline(
      historyOf(seriesOf('resting_heart_rate', alternating(62, 3))),
      'resting_heart_rate',
    );

    expect(baseline.ready).toBe(true);
  });

  it('computes systolic and diastolic separately (systolic SD 8, diastolic SD 6)', () => {
    const days = alternating(118, 8).map((systolic, index) => ({
      systolic,
      diastolic: alternating(76, 6)[index],
    }));
    const history = historyOf(days);

    const systolic = computeBaseline(history, 'systolic');
    const diastolic = computeBaseline(history, 'diastolic');

    expect(systolic.indicator).toBe('systolic');
    expect(systolic.mean).toBe(118);
    expect(systolic.sd).toBe(8);
    expect(diastolic.indicator).toBe('diastolic');
    expect(diastolic.mean).toBe(76);
    expect(diastolic.sd).toBe(6);
  });

  it.each(BaselineIndicator.options)(
    '%s: 14 identical values give sd = MIN_SD (never 0)',
    (indicator) => {
      const baseline = computeBaseline(
        historyOf(seriesOf(indicator, constant(IDENTICAL[indicator]))),
        indicator,
      );

      expect(baseline.ready).toBe(true);
      expect(baseline.mean).toBe(IDENTICAL[indicator]);
      expect(baseline.sd).toBe(MIN_SD[indicator]);
      expect(baseline.sd).toBeGreaterThan(0);
    },
  );
});

describe('isOutsideNormal (RN3, team criterion: all last 3 beyond mean ± 2 SD)', () => {
  const pulseBaseline = computeBaseline(
    historyOf(seriesOf('resting_heart_rate', alternating(62, 3))),
    'resting_heart_rate',
  );

  it('baseline 62 ± 3 with the last 3 values at 72 is outside normal (RN3 example)', () => {
    expect(pulseBaseline.mean).toBe(62);
    expect(pulseBaseline.sd).toBe(3);

    expect(isOutsideNormal('resting_heart_rate', [72, 72, 72], pulseBaseline)).toBe(true);
  });

  it('is false when only 2 of the last 3 values are outside', () => {
    expect(isOutsideNormal('resting_heart_rate', [72, 72, 62], pulseBaseline)).toBe(false);
  });

  it('is false when exactly 2 SD away (the bound is strict: 62 + 2 × 3 = 68)', () => {
    expect(isOutsideNormal('resting_heart_rate', [68, 68, 68], pulseBaseline)).toBe(false);
  });

  it('is false with fewer than 3 values', () => {
    expect(isOutsideNormal('resting_heart_rate', [72, 72], pulseBaseline)).toBe(false);
  });

  it('is false when the baseline is not ready', () => {
    const notReady = computeBaseline(
      historyOf(seriesOf('resting_heart_rate', alternating(62, 3, 13))),
      'resting_heart_rate',
    );

    expect(notReady.ready).toBe(false);
    expect(isOutsideNormal('resting_heart_rate', [72, 72, 72], notReady)).toBe(false);
  });

  it.each(BaselineIndicator.options)(
    '%s: a reading one unit away from 14 identical values is not outside normal',
    (indicator) => {
      const baseline = computeBaseline(
        historyOf(seriesOf(indicator, constant(IDENTICAL[indicator]))),
        indicator,
      );
      const step = ONE_STEP[indicator];
      const mean = IDENTICAL[indicator];

      expect(isOutsideNormal(indicator, [mean + step, mean + step, mean + step], baseline)).toBe(false);
      expect(isOutsideNormal(indicator, [mean - step, mean - step, mean - step], baseline)).toBe(false);
    },
  );

  it.each(BaselineIndicator.options)(
    '%s: three readings 3 × MIN_SD away from 14 identical values are outside normal',
    (indicator) => {
      const baseline = computeBaseline(
        historyOf(seriesOf(indicator, constant(IDENTICAL[indicator]))),
        indicator,
      );
      const far = IDENTICAL[indicator] + 3 * MIN_SD[indicator];

      expect(isOutsideNormal(indicator, [far, far, far], baseline)).toBe(true);
    },
  );
});

describe('evaluateCheck with the personal baseline (RN3)', () => {
  // History (newest first): 2 recent days at pulse 72, then the 14 baseline days 62 ± 3.
  const history = historyOf(seriesOf('resting_heart_rate', [...alternating(62, 3), 72, 72]));

  /** Today's values: everything green, pulse as given. */
  const evaluateWithPulse = (pulse: number) => {
    const today = recordOf(BASELINE_DAYS + 2, {
      sleep_hours: 7.5,
      mood: 5,
      systolic: 118,
      diastolic: 76,
      resting_heart_rate: pulse,
      body_temperature: 36.8,
      oxygen_saturation: 97,
    });
    const observations: Observation[] = [...today.observations];
    return evaluateCheck({ observations, symptoms: [], history, formatValue: () => '' });
  };

  it('pulse 72 on the last 3 check-ins gives attention with action.outside_normal, though 72 is green', () => {
    const result = evaluateWithPulse(72);

    // The reading shows the outside-normal value on the sensor: amber with the team-criterion mark.
    expect(result.readings.pulse.level).toBe('amber');
    expect(result.readings.pulse.teamCriterion).toBe(true);
    expect(result.readings.pulse.reason).toBe('resting_heart_rate');
    expect(result.readings.pulse.outsideNormal).toBe(true);
    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.outside_normal');
  });

  it('pulse 62 today with the same history stays ok (62 is normal, so not all of the last 3 are outside)', () => {
    const result = evaluateWithPulse(62);

    expect(result.readings.pulse.outsideNormal).toBe(false);
    expect(result.verdict).toBe('ok');
    expect(result.actionKey).toBe('');
  });
});
