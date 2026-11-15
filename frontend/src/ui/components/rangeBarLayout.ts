/**
 * Pure layout of one metric range bar (ui-build §3 #4, design "Metric row").
 *
 * Zones and cuts come from `THRESHOLDS` and `TEMP_IN_DOUBT_BAND` (health-rules), never from
 * hand-written numbers. Decision D32: a band whose red is conditional (`consecutiveForRed`, or
 * `requiresSymptoms` such as pulse < 50) is drawn amber; unconditional red stays red.
 * Bands are half-open `[min, max)`, as in health-rules. Where bands overlap, the worst drawn
 * level wins (`in_doubt` first, as `levelFor` checks it before any band).
 */
import type { Baseline, BloodPressure, Level, SensorKey, Threshold } from '@base-vital/contracts';
import { TEMP_IN_DOUBT_BAND, THRESHOLDS } from '@base-vital/health-rules';
import { SENSOR_BASELINE, SENSOR_INDICATOR } from '../../config/constants';

export interface RangeBarZone {
  level: Level;
  /** Percent of the scale, 0–100. */
  fromPct: number;
  toPct: number;
}

export interface RangeBarCut {
  /** Percent of the scale where the drawn level changes. */
  pct: number;
  /** Raw threshold value, shown on the labels line. */
  value: number;
}

export interface RangeBarLayout {
  zones: RangeBarZone[];
  /**
   * Cut points between zones. Not drawn on screen since D40 (the centred allowed range replaces the cut
   * numbers); only the layout tests read them. Kept so the zone geometry stays covered by tests.
   */
  markerPct: number | null;
  baselinePct: { from: number; to: number } | null;
  cuts: RangeBarCut[];
}

export interface RangeBarInput {
  sensor: SensorKey;
  value: number | BloodPressure | null;
  baseline: Baseline | null;
  /** `[min, max]` in the sensor's unit, e.g. `UI_SCALES` from config/constants.ts. */
  scale: readonly [number, number];
}

const PERCENT = 100;
/** Divisor of the midpoint of a segment, used to test which bands cover it. */
const HALF = 2;
/** Half-width of the "tu normal" bracket in SD (RN3 wording: mean ± 2·SD). */
const BRACKET_SD = 2;

/** Overlap priority: `in_doubt` first (as `levelFor`), then the worst level; `unknown` loses to any band. */
const PRIORITY: Readonly<Record<Level, number>> = {
  unknown: 0,
  green: 1,
  amber: 2,
  red: 3,
  in_doubt: 4,
};

type BandLevel = Exclude<Level, 'unknown'>;

/** One drawn band in raw units, half-open `[low, high)`. Unbounded sides are ±Infinity. */
interface DrawnBand {
  low: number;
  high: number;
  level: BandLevel;
}

/** A run of the scale with one drawn level, in raw units. */
interface Segment {
  level: Level;
  from: number;
  to: number;
}

/** D32: a red band that needs consecutive days or a symptom is drawn amber until it is met. */
function isConditionalRed(entry: Threshold): boolean {
  return entry.consecutiveForRed !== undefined || entry.requiresSymptoms === true;
}

/** Every drawn band of one sensor, in raw units. */
function drawnBandsOf(sensor: SensorKey): DrawnBand[] {
  const bands: DrawnBand[] = [];
  if (sensor === 'temperature') {
    bands.push({
      low: TEMP_IN_DOUBT_BAND.min ?? -Infinity,
      high: TEMP_IN_DOUBT_BAND.max ?? Infinity,
      level: 'in_doubt',
    });
  }

  // Blood pressure is drawn from the systolic entries only.
  const component = sensor === 'pressure' ? 'systolic' : undefined;
  for (const entry of THRESHOLDS) {
    if (entry.indicator !== SENSOR_INDICATOR[sensor] || entry.component !== component) continue;
    for (const name of ['green', 'amber', 'red'] as const) {
      const band = entry[name];
      // `{}` means the entry does not define this band.
      if (band.min === undefined && band.max === undefined) continue;
      const level: BandLevel = name === 'red' && isConditionalRed(entry) ? 'amber' : name;
      bands.push({ low: band.min ?? -Infinity, high: band.max ?? Infinity, level });
    }
  }
  return bands;
}

/** The highest-priority drawn level among the bands covering a point; `unknown` if none. */
function levelCovering(bands: readonly DrawnBand[], point: number): Level {
  let worst: Level = 'unknown';
  for (const band of bands) {
    if (band.low <= point && point < band.high && PRIORITY[band.level] > PRIORITY[worst]) {
      worst = band.level;
    }
  }
  return worst;
}

/**
 * Splits `[min, max]` at every band edge, then merges neighbours with the same drawn level, so
 * a cut only appears where the drawn level changes.
 */
function segmentsOf(bands: readonly DrawnBand[], min: number, max: number): Segment[] {
  const clip = (point: number) => Math.min(max, Math.max(min, point));
  const edges = [min, max, ...bands.flatMap((band) => [clip(band.low), clip(band.high)])];
  const points = [...new Set(edges)].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    const level = levelCovering(bands, (from + to) / HALF);
    const last = segments[segments.length - 1];
    if (last !== undefined && last.level === level) {
      last.to = to;
    } else {
      segments.push({ level, from, to });
    }
  }
  return segments;
}

/** The value a reading is drawn with; blood pressure uses the systolic value (RN1). */
function numericOf(value: number | BloodPressure | null): number | null {
  if (value === null) return null;
  return typeof value === 'number' ? value : value.systolic;
}

/** Layout of one range bar: zones, marker, "tu normal" bracket and cut points. */
export function computeRangeBar(input: RangeBarInput): RangeBarLayout {
  const [min, max] = input.scale;
  const pct = (point: number) => ((point - min) / (max - min)) * PERCENT;
  const clampedPct = (point: number) => Math.min(PERCENT, Math.max(0, pct(point)));

  const segments = segmentsOf(drawnBandsOf(input.sensor), min, max);
  const zones: RangeBarZone[] = segments.map((segment) => ({
    level: segment.level,
    fromPct: pct(segment.from),
    toPct: pct(segment.to),
  }));
  // Scale ends are never cuts: the first segment starts at `min`, so cuts start from the second.
  const cuts: RangeBarCut[] = segments
    .slice(1)
    .map((segment) => ({ pct: pct(segment.from), value: segment.from }));

  const value = numericOf(input.value);
  const markerPct = value === null ? null : clampedPct(value);

  const baselinePct =
    input.baseline === null ||
    !input.baseline.ready ||
    input.baseline.indicator !== SENSOR_BASELINE[input.sensor]
      ? null
      : {
          from: clampedPct(input.baseline.mean - BRACKET_SD * input.baseline.sd),
          to: clampedPct(input.baseline.mean + BRACKET_SD * input.baseline.sd),
        };

  return { zones, markerPct, baselinePct, cuts };
}
