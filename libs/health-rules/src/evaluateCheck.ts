import {
  SENSOR_INDICATORS,
  SensorKey,
  type CheckRecord,
  type Indicator,
  type Level,
  type Observation,
  type SensorPhase,
  type SensorReading,
  type Symptom,
  type Verdict,
} from '@base-vital/contracts';
import { levelFor, type LevelResult } from './levels';
import { FEVER_MIN_CELSIUS } from './thresholds';
import { decideVerdict, type IndicatorOutcome } from './verdict';

/** Worst first: red > amber > in_doubt > unknown > green (a sensor takes its worst indicator). */
const LEVEL_RANK: Record<Level, number> = { red: 0, amber: 1, in_doubt: 2, unknown: 3, green: 4 };

/** The indicator whose value a sensor displays (sleep shows hours, not mood). */
const PRIMARY_INDICATOR: Record<SensorKey, Indicator> = {
  sleep: 'sleep_hours',
  pulse: 'resting_heart_rate',
  pressure: 'blood_pressure',
  temperature: 'body_temperature',
  oxygen: 'oxygen_saturation',
};

/** Message key of the one action that names a sensor with no reading. */
const MISSING_DATA_ACTION = 'action.missing_data';

export interface EvaluateInput {
  observations: readonly Observation[];
  symptoms: readonly Symptom[];
  /** Previous days, newest first. */
  history: readonly CheckRecord[];
  /**
   * Display text of a sensor's primary observation (`undefined` when missing). The rules layer
   * has no UI text: the caller supplies the words and units.
   */
  formatValue: (indicator: Indicator, observation: Observation | undefined) => string;
}

export interface EvaluateResult {
  readings: Record<SensorKey, SensorReading>;
  verdict: Verdict;
  /** Full message key, e.g. `action.slept_little`; `''` when the verdict is `ok`. */
  actionKey: string;
  /** True when the outcomes that set the action are a team criterion (Principle VIII). */
  actionTeamCriterion: boolean;
  /** First sensor whose reading is `unknown`, when `actionKey` is `action.missing_data`; else `null`. */
  missingSensor: SensorKey | null;
}

/** One indicator of a sensor, with its level and the facts the verdict needs. */
interface IndicatorPart extends IndicatorOutcome {
  observed: boolean;
  /** The observation the level was computed from; `undefined` when missing. */
  observation: Observation | undefined;
}

/** Last observation per indicator; a later observation of the same indicator wins. */
function latestByIndicator(observations: readonly Observation[]): Map<Indicator, Observation> {
  const latest = new Map<Indicator, Observation>();
  for (const observation of observations) latest.set(observation.indicator, observation);
  return latest;
}

/**
 * Previous days' values of one indicator, newest first. Stops at the first day without a
 * numeric value, so `levelFor` only sees consecutive days (RN2).
 */
export function historyValues(history: readonly CheckRecord[], indicator: Indicator): number[] {
  const values: number[] = [];
  for (const record of history) {
    const observation = latestByIndicator(record.observations).get(indicator);
    if (observation === undefined || typeof observation.value !== 'number') break;
    values.push(observation.value);
  }
  return values;
}

function partFor(
  indicator: Indicator,
  observation: Observation | undefined,
  input: EvaluateInput,
): IndicatorPart {
  if (observation === undefined) {
    // CL2: a missing indicator is `unknown`, never ok.
    return {
      indicator,
      level: 'unknown',
      fever: false,
      observed: false,
      teamCriterion: false,
      observation,
    };
  }
  const result: LevelResult = levelFor(indicator, observation.value, {
    history: historyValues(input.history, indicator),
    symptoms: input.symptoms,
  });
  const fever =
    indicator === 'body_temperature' &&
    result.level === 'red' &&
    typeof observation.value === 'number' &&
    observation.value >= FEVER_MIN_CELSIUS;
  return {
    indicator,
    level: result.level,
    fever,
    observed: true,
    teamCriterion: result.teamCriterion,
    observation,
  };
}

/**
 * Reading of one sensor: its worst indicator sets the level, the reason and the team-criterion
 * flag. Green has no reason and is never a team criterion (nothing set it).
 */
function readingFor(
  sensor: SensorKey,
  parts: readonly IndicatorPart[],
  latest: ReadonlyMap<Indicator, Observation>,
  input: EvaluateInput,
): SensorReading {
  const worst = parts.reduce((a, b) => (LEVEL_RANK[b.level] < LEVEL_RANK[a.level] ? b : a));
  const phase: SensorPhase =
    worst.level === 'in_doubt' ? 'in_doubt' : parts.some((part) => part.observed) ? 'confirmed' : 'idle';
  const green = worst.level === 'green';
  const primary = PRIMARY_INDICATOR[sensor];
  return {
    sensor,
    level: worst.level,
    phase,
    value: input.formatValue(primary, latest.get(primary)),
    // US4 (personal baseline) is not implemented yet.
    outsideNormal: false,
    teamCriterion: green ? false : worst.teamCriterion,
    reason: green ? null : worst.indicator,
  };
}

/**
 * Verdict of one check-in (RN1, RN5, RN6, CL2). Pure: no I/O.
 *
 * `observations` are the confirmed voice values and the device values of the check-in.
 * `history` is the previous days' records, newest first; it feeds the consecutive-day rules.
 */
export function evaluateCheck(input: EvaluateInput): EvaluateResult {
  const latest = latestByIndicator(input.observations);
  const readings = {} as Record<SensorKey, SensorReading>;
  const outcomes: IndicatorOutcome[] = [];

  for (const sensor of SensorKey.options) {
    const indicators: readonly Indicator[] = SENSOR_INDICATORS[sensor];
    const parts = indicators.map((indicator) => partFor(indicator, latest.get(indicator), input));
    readings[sensor] = readingFor(sensor, parts, latest, input);
    outcomes.push(...parts);
  }

  const { verdict, actionKey, actionTeamCriterion } = decideVerdict({
    outcomes,
    symptoms: input.symptoms,
    // US4 (personal baseline) is not implemented yet.
    outsideNormal: false,
  });
  // A sensor with no reading is `unknown` (CL2); the first one names the missing data.
  const missingSensor =
    actionKey === MISSING_DATA_ACTION
      ? (SensorKey.options.find((sensor) => readings[sensor].level === 'unknown') ?? null)
      : null;
  return { readings, verdict, actionKey, actionTeamCriterion, missingSensor };
}
