import type { RangeBand, Threshold } from '@base-vital/contracts';

/**
 * RN1 ranges as data (Principle VIII). Every entry is a `Threshold` (contracts schema) and
 * defines one band group: the bands it owns come from the source named in `source`, or, for a
 * `team_criterion` entry, from the team (shown as "criterio del equipo, no clínico").
 *
 * Conventions:
 * - Bands are half-open: `min` is inclusive, `max` is exclusive, so a band is `[min, max)`.
 *   A missing bound is unbounded on that side. `max: 120` on blood pressure means "below 120".
 *   Half-open bands let real values (e.g. SpO₂ 89.9, systolic 119.5) fall in exactly one band.
 * - A band an entry does not define is `{}`. `RangeBand` has no "absent" form, so consumers
 *   read only the bands an entry defines; together the entries of one indicator cover its ranges
 *   with no gaps and no overlaps between levels (except where a red band is gated, see below).
 * - `consecutiveForRed` gates a red band: the value is red only after that many consecutive
 *   readings or days (RN1, RN2). Until then the same value is amber.
 * - A red band marked `requiresSymptoms` (pulse < 50, RN1) is only red together with a symptom;
 *   the caller (`levels.ts`) checks the flag before using that band.
 * - Blood pressure is split into two entries (`component` systolic and diastolic), each owning
 *   all three bands; the level of a reading is the worse of the two components.
 *
 * Units: pressure mmHg, pulse bpm, sleep h, mood points, temperature °C, SpO₂ %.
 */
/** Fever bound (CDC): body temperature at or above this is red. Also read by the verdict rules. */
export const FEVER_MIN_CELSIUS = 38;

export const THRESHOLDS: readonly Threshold[] = [
  // Blood pressure, AHA/ACC 2025: < 120 / < 80 green; 120–139 or 80–89 amber; ≥ 140 or ≥ 90 red.
  {
    indicator: 'blood_pressure',
    component: 'systolic',
    green: { max: 120 },
    amber: { min: 120, max: 140 },
    red: { min: 140 },
    source: 'AHA/ACC 2025 High Blood Pressure Guideline (systolic, mmHg)',
    sourceStatus: 'cited',
  },
  {
    indicator: 'blood_pressure',
    component: 'diastolic',
    green: { max: 80 },
    amber: { min: 80, max: 90 },
    red: { min: 90 },
    source: 'AHA/ACC 2025 High Blood Pressure Guideline (diastolic, mmHg)',
    sourceStatus: 'cited',
  },

  // Resting pulse: green 60–100 cited (AHA), i.e. [60, 101). Everything else is a team criterion.
  {
    indicator: 'resting_heart_rate',
    green: { min: 60, max: 101 },
    amber: {},
    red: {},
    source: 'American Heart Association — All About Heart Rate (Pulse)',
    sourceStatus: 'cited',
  },
  // Team criterion: below 60 is amber (50–59 and, without symptoms, < 50; RN1: atención).
  // Red below 50 only with a symptom (RN1, `requiresSymptoms`); the symptom check is done by levels.ts.
  {
    indicator: 'resting_heart_rate',
    green: {},
    amber: { max: 60 },
    red: { max: 50 },
    requiresSymptoms: true,
    sourceStatus: 'team_criterion',
  },
  // Team criterion: 101–110 amber; 111 and above red (i.e. above 110).
  {
    indicator: 'resting_heart_rate',
    green: {},
    amber: { min: 101, max: 111 },
    red: { min: 111 },
    sourceStatus: 'team_criterion',
  },

  // Sleep: ≥ 7 h green, below 7 h amber (AASM/SRS). Amber covers 6–6.9 h and, for one or two
  // nights, below 6 h (RN2). The AASM/SRS recommendation is the source of the 7 h bound.
  {
    indicator: 'sleep_hours',
    green: { min: 7 },
    amber: { max: 7 },
    red: {},
    source: 'AASM/SRS Joint Consensus Statement (Watson et al., 2015)',
    sourceStatus: 'cited',
  },
  // Team criterion: red only after three consecutive nights below 6 h (RN1, RN2). Amber for
  // those nights comes from the cited entry above.
  {
    indicator: 'sleep_hours',
    green: {},
    amber: {},
    red: { max: 6 },
    consecutiveForRed: 3,
    sourceStatus: 'team_criterion',
  },

  // Body temperature. The 37.3–37.9 °C amber band is not in either source: it sits between the
  // MedlinePlus normal range (upper bound 37.2 °C) and the CDC fever threshold (38.0 °C), so it is
  // kept in the MedlinePlus entry as the amber band (research R9, spec RN1).
  {
    indicator: 'body_temperature',
    green: { min: 36.1, max: 37.3 },
    amber: { min: 37.3, max: 38 },
    red: {},
    source: 'MedlinePlus — Body temperature norms',
    sourceStatus: 'cited',
  },
  // Fever: 38.0 °C or higher is red.
  {
    indicator: 'body_temperature',
    green: {},
    amber: {},
    red: { min: FEVER_MIN_CELSIUS },
    source: 'CDC — Definitions of Signs, Symptoms, and Conditions of Ill Travelers',
    sourceStatus: 'cited',
  },
  // Hypothermia: below 35.0 °C is red. [35.0, 36.1) is `in_doubt`, see TEMP_IN_DOUBT_BAND.
  {
    indicator: 'body_temperature',
    green: {},
    amber: {},
    red: { max: 35 },
    source: 'Mayo Clinic — Hypothermia: Symptoms and causes',
    sourceStatus: 'cited',
  },

  // Oxygen saturation: ≥ 95 % green; 90–94.9 % amber; < 90 % red (WHO).
  {
    indicator: 'oxygen_saturation',
    green: { min: 95 },
    amber: { min: 90, max: 95 },
    red: { max: 90 },
    source: 'WHO Pulse Oximetry Training Manual (2011)',
    sourceStatus: 'cited',
  },

  // Mood (1–5 scale): 4 and up green; 3 amber; ≤ 2 amber for one day and red after two
  // consecutive days.
  {
    indicator: 'mood',
    green: { min: 4 },
    amber: { min: 3, max: 4 },
    red: { max: 3 },
    consecutiveForRed: 2,
    sourceStatus: 'team_criterion',
  },
];

/**
 * Body temperature band that is `in_doubt`, not a level: the thermometer is read once more
 * (RN1, RN4). Not part of `Threshold` because the schema has no field for an in-doubt band.
 * Half-open like every band: [35.0, 36.1) °C, i.e. 35.0–36.0 °C at one decimal.
 */
export const TEMP_IN_DOUBT_BAND: RangeBand = { min: 35, max: 36.1 };
