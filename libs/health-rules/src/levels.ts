import type {
  BloodPressure,
  Indicator,
  Level,
  RangeBand,
  Symptom,
  Threshold,
} from '@base-vital/contracts';
import { TEMP_IN_DOUBT_BAND, THRESHOLDS } from './thresholds';

/** Context a level needs beyond the value itself (RN1, RN2). */
export type LevelContext = {
  /** Previous days' values for the same indicator, most recent first. */
  history?: readonly number[];
  symptoms?: readonly Symptom[];
};

export type LevelResult = {
  level: Level;
  /** True when the band that set the level is a team criterion (shown with "*"). */
  teamCriterion: boolean;
};

type BandName = 'red' | 'amber' | 'green';
type Component = 'systolic' | 'diastolic';

/** Checked worst first, so the first band that matches decides the level. */
const BANDS_WORST_FIRST: readonly BandName[] = ['red', 'amber', 'green'];
/** Ordered from best to worst; used to pick the worse blood pressure component. */
const LEVELS_BEST_TO_WORST: readonly Level[] = ['green', 'amber', 'red'];

/**
 * True when `value` is inside `band`, half-open `[min, max)`. A band with neither bound is `{}`
 * (not defined by the entry), so it never matches.
 */
function inBand(value: number, band: RangeBand): boolean {
  if (band.min === undefined && band.max === undefined) return false;
  return (
    (band.min === undefined || value >= band.min) && (band.max === undefined || value < band.max)
  );
}

/** RN1: a red band marked `requiresSymptoms` (pulse < 50) is red only with a symptom. */
function needsSymptom(entry: Threshold): boolean {
  return entry.requiresSymptoms === true;
}

/** RN1 / RN2: a red band with `consecutiveForRed` needs the same band on the previous days. */
function consecutiveMet(entry: Threshold, history: readonly number[]): boolean {
  const needed = entry.consecutiveForRed;
  if (needed === undefined) return true;
  const previous = needed - 1; // the current reading counts as the first one
  return history.length >= previous && history.slice(0, previous).every((v) => inBand(v, entry.red));
}

/** Whether a matched red band may stand; otherwise the value is amber (attention). */
function redAllowed(entry: Threshold, context: Required<LevelContext>): boolean {
  if (needsSymptom(entry)) return context.symptoms.some((symptom) => symptom !== 'none');
  return consecutiveMet(entry, context.history);
}

/**
 * Whether a level set by `entry` counts as a team criterion. Mood is always a team criterion.
 * RN1 flags only the 3-night sleep rule, so amber sleep (6–6.9 h, or < 6 h for one or two
 * nights) is not flagged even though its entry is `team_criterion`.
 */
function isTeamCriterion(indicator: Indicator, level: Level, entry: Threshold): boolean {
  if (indicator === 'mood') return true;
  if (indicator === 'sleep_hours' && level === 'amber') return false;
  return entry.sourceStatus === 'team_criterion';
}

function entriesFor(indicator: Indicator, component?: Component): Threshold[] {
  return THRESHOLDS.filter((entry) => entry.indicator === indicator && entry.component === component);
}

/** Level of one value against the entries of one indicator (or one blood pressure component). */
function levelOfValue(
  indicator: Indicator,
  entries: readonly Threshold[],
  value: number,
  context: Required<LevelContext>,
): LevelResult {
  for (const band of BANDS_WORST_FIRST) {
    for (const entry of entries) {
      if (!inBand(value, entry[band])) continue;
      if (band === 'red' && !redAllowed(entry, context)) {
        return { level: 'amber', teamCriterion: isTeamCriterion(indicator, 'amber', entry) };
      }
      return { level: band, teamCriterion: isTeamCriterion(indicator, band, entry) };
    }
  }
  return { level: 'unknown', teamCriterion: false };
}

/** Blood pressure: each component has its own level; the reading takes the worse one. */
function levelOfBloodPressure(value: BloodPressure, context: Required<LevelContext>): LevelResult {
  const systolic = levelOfValue(
    'blood_pressure',
    entriesFor('blood_pressure', 'systolic'),
    value.systolic,
    context,
  );
  const diastolic = levelOfValue(
    'blood_pressure',
    entriesFor('blood_pressure', 'diastolic'),
    value.diastolic,
    context,
  );
  const rank = (level: Level) => LEVELS_BEST_TO_WORST.indexOf(level);
  return rank(diastolic.level) > rank(systolic.level) ? diastolic : systolic;
}

/**
 * Level of one reading (RN1, RN2). Pure: thresholds come from `THRESHOLDS`, no I/O.
 *
 * - Blood pressure takes `{ systolic, diastolic }`; every other indicator takes a number.
 * - Red bands gated by `consecutiveForRed` or by symptoms fall back to amber until the gate holds.
 * - Body temperature in [35.0, 36.1) °C is `in_doubt`, not a level (RN1, RN4).
 */
export function levelFor(
  indicator: Indicator,
  value: number | BloodPressure,
  context: LevelContext = {},
): LevelResult {
  const resolved: Required<LevelContext> = {
    history: context.history ?? [],
    symptoms: context.symptoms ?? [],
  };

  if (indicator === 'blood_pressure') {
    if (typeof value === 'number') {
      throw new TypeError('blood_pressure needs { systolic, diastolic }');
    }
    return levelOfBloodPressure(value, resolved);
  }

  if (typeof value !== 'number') {
    throw new TypeError(`${indicator} needs a number`);
  }
  if (indicator === 'body_temperature' && inBand(value, TEMP_IN_DOUBT_BAND)) {
    return { level: 'in_doubt', teamCriterion: false };
  }
  return levelOfValue(indicator, entriesFor(indicator), value, resolved);
}
