/**
 * Metric rows of "Estado de {name}" (FR-016, CA7, SC-011, T091). One entry per sensor reading of a
 * check, with what its range bar needs: the number on the bar (marker), the scale, the allowed
 * range as text, the "tu normal" baseline, and where the value came from. Pure: the readings, the
 * check's observations and the previous days are passed in. Used by Home and by the check-in.
 */
import {
  SensorKey,
  type Baseline,
  type CheckRecord,
  type Indicator,
  type Level,
  type Observation,
  type RangeBand,
  type SensorReading,
  type Source,
} from '@base-vital/contracts';
import { THRESHOLDS, computeBaseline } from '@base-vital/health-rules';
import { SENSOR_BASELINE, SENSOR_INDICATOR, UI_SCALES } from '../../config/constants';
import { formatNumber, t } from '../../config/messages.es';

/** One metric row: what the sensor reading says and how its range bar is drawn. */
export interface StatusReading {
  sensor: SensorKey;
  /** Display value with its unit, as the check stored it, e.g. "118/76 mmHg" or "5 h". */
  value: string;
  /** Unit of the scale, e.g. "mmHg" or "h". */
  unit: string;
  /** Number drawn on the range bar: systolic for blood pressure; `null` when the check has none. */
  marker: number | null;
  /** `[min, max]` of the bar, from `UI_SCALES`. */
  scale: readonly [number, number];
  /** Allowed range as text, derived from the green band of the thresholds, e.g. "< 120/80", "60–100". */
  allowedLabel: string;
  /** Where the value came from; `null` when the check has no observation for the sensor. */
  source: Source | null;
  simulated: boolean;
  level: Level;
  reason: Indicator | null;
  teamCriterion: boolean;
  /** "Tu normal" (RN3) computed over the previous days; `ready` is false while they are fewer than 14. */
  baseline: Baseline;
}

export interface MetricReadingsInput {
  /** Readings of the check, one per sensor; a sensor with no reading is left out. */
  readings: readonly SensorReading[];
  /** Observations of the same check, the source of each marker. */
  observations: readonly Observation[];
  /** Previous days' checks, newest first (`previousChecksBefore`). */
  previousChecks: readonly CheckRecord[];
}

/**
 * Resolution of the allowed range's last shown value: a band `[min, max)` ends one step below `max`.
 * Pulse is shown in whole beats, temperature in tenths of a degree, sleep in half hours (RN4).
 */
const DISPLAY_STEP: Readonly<Record<SensorKey, number>> = {
  sleep: 0.5,
  pulse: 1,
  pressure: 1,
  temperature: 0.1,
  oxygen: 1,
};

/** The latest observation of `indicator` in the check, or `undefined`. */
function latestObservation(observations: readonly Observation[], indicator: Indicator): Observation | undefined {
  let found: Observation | undefined;
  for (const observation of observations) {
    if (observation.indicator === indicator) found = observation;
  }
  return found;
}

/** The number a range bar places: systolic for blood pressure (RN1). Mood has no bar. */
function markerOf(observation: Observation | undefined): number | null {
  if (observation === undefined) return null;
  switch (observation.indicator) {
    case 'blood_pressure':
      return observation.value.systolic;
    case 'mood':
      return null;
    default:
      return observation.value;
  }
}

/** The first green band of a guideline entry for `indicator` (and blood-pressure `component`) that sets a bound. */
function greenBandOf(indicator: Indicator, component?: 'systolic' | 'diastolic'): RangeBand | undefined {
  const entry = THRESHOLDS.find(
    (threshold) =>
      threshold.indicator === indicator &&
      threshold.component === component &&
      (threshold.green.min !== undefined || threshold.green.max !== undefined),
  );
  return entry?.green;
}

/** Allowed range of one sensor as text, from its green band (CA7). Empty when no band sets a bound. */
function allowedLabelOf(sensor: SensorKey): string {
  if (sensor === 'pressure') {
    const systolic = greenBandOf('blood_pressure', 'systolic')?.max;
    const diastolic = greenBandOf('blood_pressure', 'diastolic')?.max;
    if (systolic === undefined || diastolic === undefined) return '';
    return t('allowed.bloodPressure', { systolic, diastolic });
  }
  const band = greenBandOf(SENSOR_INDICATOR[sensor]);
  if (band === undefined) return '';
  const { min, max } = band;
  if (min !== undefined && max !== undefined) {
    return t('allowed.range', { min: formatNumber(min), max: formatNumber(max - DISPLAY_STEP[sensor]) });
  }
  if (min !== undefined) {
    return sensor === 'sleep' ? t('allowed.atLeastHours', { value: min }) : t('allowed.atLeast', { value: min });
  }
  return max === undefined ? '' : t('allowed.below', { value: max });
}

/** Metric rows of one check, in `SensorKey` order; a sensor with no reading gets no row. */
export function metricReadingsOf(input: MetricReadingsInput): StatusReading[] {
  const bySensor = new Map(input.readings.map((reading) => [reading.sensor, reading]));
  return SensorKey.options.flatMap((sensor) => {
    const reading = bySensor.get(sensor);
    if (reading === undefined) return [];
    const observation = latestObservation(input.observations, SENSOR_INDICATOR[sensor]);
    const scale = UI_SCALES[sensor];
    return [
      {
        sensor,
        value: reading.value,
        unit: t(scale.unitKey),
        marker: markerOf(observation),
        scale: [scale.min, scale.max],
        allowedLabel: allowedLabelOf(sensor),
        source: observation?.source ?? null,
        simulated: observation?.simulated ?? false,
        level: reading.level,
        reason: reading.reason,
        teamCriterion: reading.teamCriterion,
        baseline: computeBaseline(input.previousChecks, SENSOR_BASELINE[sensor]),
      },
    ];
  });
}
