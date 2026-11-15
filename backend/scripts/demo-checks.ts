import type { Indicator, SensorKey, SensorReading, Symptom, Verdict } from '../src/shared/contracts';
import type { SyncCheck } from '../src/domain/sync-check';
import { MS_PER_DAY } from '../src/config/constants';

// Deterministic simulated history for the demo (FR-016). Pure: no I/O, no clock, no randomness
// beyond the fixed-seed PRNG below, so two calls return deep-equal results.

/** Crew member the demo history belongs to. */
export const DEMO_CREW_ID = 'crew-a1b2c3';

/** Mission start date the history implies (`YYYY-MM-DD`, UTC). Derived by the ingest, not sent. */
export const DEMO_MISSION_START_DATE = '2026-10-24';

/** Mission day of the first demo check (2026-11-01 is day 9 since 2026-10-24). */
const FIRST_MISSION_DAY = 9;

/** `completedAt` of the first demo check; each following day adds 24 h. */
const FIRST_COMPLETED_AT = '2026-11-01T08:00:00.000Z';

/** Number of simulated daily checks. */
const DEMO_DAY_COUNT = 14;

/** Mission days whose sleep is short, producing one `attention` verdict each. */
const SHORT_SLEEP_MISSION_DAY_A = 14;
const SHORT_SLEEP_MISSION_DAY_B = 19;
const SHORT_SLEEP_HOURS = 5;

/** Seed of the fixed PRNG; changing it changes the demo history. */
const DEMO_SEED = 20261024;

/** Sleep is drawn in half-hour steps: 13 steps = 6.5 h, 16 steps = 8 h. */
const SLEEP_STEPS_PER_HOUR = 2;
const SLEEP_MIN_STEPS = 13;
const SLEEP_MAX_STEPS = 16;

const MOOD_MIN = 3;
const MOOD_MAX = 5;

const PULSE_MIN = 58;
const PULSE_MAX = 70;

const SYSTOLIC_MIN = 110;
const SYSTOLIC_MAX = 124;
const DIASTOLIC_MIN = 70;
const DIASTOLIC_MAX = 80;

/** Temperature is drawn in tenths of a degree: 363 = 36.3 °C, 369 = 36.9 °C. */
const TENTHS_PER_DEGREE = 10;
const TEMPERATURE_MIN_TENTHS = 363;
const TEMPERATURE_MAX_TENTHS = 369;

const SPO2_MIN = 96;
const SPO2_MAX = 99;

/** Fixed prefix of the deterministic v4-shaped `clientCheckId`s; the last two digits are the day. */
const CLIENT_CHECK_ID_PREFIX = '00000000-0000-4000-8000-0000000000';
const CLIENT_CHECK_ID_DIGITS = 2;
const CLIENT_CHECK_ID_PAD = '0';

const ACTION_SLEPT_LITTLE = 'action.slept_little';
const SYMPTOMS_NONE: Symptom[] = ['none'];

/** Mulberry32 constants (public-domain 32-bit PRNG). */
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_SHIFT_HIGH = 15;
const MULBERRY_SHIFT_MID = 7;
const MULBERRY_SHIFT_LOW = 14;
const MULBERRY_ODD_MASK = 1;
const MULBERRY_MUL_MASK = 61;
const UINT32_RANGE = 4294967296;

/** Returns a deterministic generator of floats in [0, 1) seeded with `seed`. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + MULBERRY_INCREMENT) | 0;
    let t = Math.imul(state ^ (state >>> MULBERRY_SHIFT_HIGH), MULBERRY_ODD_MASK | state);
    t = (t + Math.imul(t ^ (t >>> MULBERRY_SHIFT_MID), MULBERRY_MUL_MASK | t)) ^ t;
    return ((t ^ (t >>> MULBERRY_SHIFT_LOW)) >>> 0) / UINT32_RANGE;
  };
}

/** Integer drawn uniformly from `min` to `max`, both inclusive. */
function drawInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** Reading for a sensor whose indicators are all within the green band. */
function greenReading(sensor: SensorKey, value: string): SensorReading {
  return {
    sensor,
    level: 'green',
    phase: 'confirmed',
    value,
    outsideNormal: false,
    teamCriterion: false,
    reason: null,
  };
}

/** Sleep reading for a short night: amber (cited AASM/SRS band, not a team criterion), outside the normal band. */
function shortSleepReading(value: string): SensorReading {
  return {
    sensor: 'sleep',
    level: 'amber',
    phase: 'confirmed',
    value,
    outsideNormal: true,
    teamCriterion: false,
    reason: 'sleep_hours',
  };
}

/** Values drawn for one day, in a fixed draw order so the PRNG stream stays stable. */
type DayValues = {
  sleepHours: number;
  mood: number;
  pulse: number;
  systolic: number;
  diastolic: number;
  temperature: number;
  oxygen: number;
};

/** Draws one day's values; every draw happens even when a value is later overridden. */
function drawDay(random: () => number): DayValues {
  const sleepSteps = drawInt(random, SLEEP_MIN_STEPS, SLEEP_MAX_STEPS);
  return {
    sleepHours: sleepSteps / SLEEP_STEPS_PER_HOUR,
    mood: drawInt(random, MOOD_MIN, MOOD_MAX),
    pulse: drawInt(random, PULSE_MIN, PULSE_MAX),
    systolic: drawInt(random, SYSTOLIC_MIN, SYSTOLIC_MAX),
    diastolic: drawInt(random, DIASTOLIC_MIN, DIASTOLIC_MAX),
    temperature: drawInt(random, TEMPERATURE_MIN_TENTHS, TEMPERATURE_MAX_TENTHS) / TENTHS_PER_DEGREE,
    oxygen: drawInt(random, SPO2_MIN, SPO2_MAX),
  };
}

/** Builds the full sync envelope for one simulated day. */
function buildCheck(index: number, values: DayValues): SyncCheck {
  const missionDay = FIRST_MISSION_DAY + index;
  const completedMs = Date.parse(FIRST_COMPLETED_AT) + index * MS_PER_DAY;
  const at = new Date(completedMs).toISOString();
  const shortSleep = missionDay === SHORT_SLEEP_MISSION_DAY_A || missionDay === SHORT_SLEEP_MISSION_DAY_B;
  const sleepHours = shortSleep ? SHORT_SLEEP_HOURS : values.sleepHours;
  const sleepValue = `${sleepHours} h`;

  const observation = (
    indicator: Indicator,
    source: 'voice' | 'device',
    value: number | { systolic: number; diastolic: number },
  ) => ({ indicator, source, confirmed: true, simulated: true, at, value });

  const readings = {
    sleep: shortSleep ? shortSleepReading(sleepValue) : greenReading('sleep', sleepValue),
    pulse: greenReading('pulse', `${values.pulse} lpm`),
    pressure: greenReading('pressure', `${values.systolic}/${values.diastolic}`),
    temperature: greenReading('temperature', `${values.temperature.toFixed(1)} °C`),
    oxygen: greenReading('oxygen', `${values.oxygen} %`),
  };

  const verdict: Verdict = shortSleep ? 'attention' : 'ok';

  return {
    clientCheckId: `${CLIENT_CHECK_ID_PREFIX}${String(index + 1).padStart(CLIENT_CHECK_ID_DIGITS, CLIENT_CHECK_ID_PAD)}`,
    crewId: DEMO_CREW_ID,
    kind: 'daily',
    missionDay,
    check: {
      id: at,
      observations: [
        observation('sleep_hours', 'voice', sleepHours),
        observation('mood', 'voice', values.mood),
        observation('resting_heart_rate', 'device', values.pulse),
        observation('blood_pressure', 'device', { systolic: values.systolic, diastolic: values.diastolic }),
        observation('body_temperature', 'device', values.temperature),
        observation('oxygen_saturation', 'device', values.oxygen),
      ] as SyncCheck['check']['observations'],
      symptoms: [...SYMPTOMS_NONE],
      readings,
      verdict,
      actionKey: shortSleep ? ACTION_SLEPT_LITTLE : '',
      simulated: true,
    },
  };
}

/**
 * The 14 simulated daily check-ins for `DEMO_CREW_ID`, mission days 9..22, oldest first.
 * Returns fresh objects on every call; the result is deep-equal across calls.
 */
export function demoSyncChecks(): unknown[] {
  const random = mulberry32(DEMO_SEED);
  const checks: SyncCheck[] = [];
  for (let index = 0; index < DEMO_DAY_COUNT; index += 1) {
    checks.push(buildCheck(index, drawDay(random)));
  }
  return checks;
}
