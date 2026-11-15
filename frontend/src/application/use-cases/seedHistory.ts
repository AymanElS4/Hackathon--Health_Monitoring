/**
 * Simulated check-in history of the 14 days before today (FR-013, U1, T088). Pure and
 * deterministic: the same scenario and `now` always give the same records. Each day is evaluated
 * with `evaluateCheck` against the days before it, exactly like a real check-in, so the stored
 * verdicts are the ones the app would have given.
 */
import {
  BloodPressure,
  CheckRecord,
  Observation,
  type DemoScenario,
  type Indicator,
} from '@base-vital/contracts';
import { evaluateCheck, levelFor } from '@base-vital/health-rules';
import sleepHistory from '../../../data/sleep-history.json';
import { DEMO_SCENARIOS } from '../../config/demoScenarios';
import type { CheckRepositoryPort } from '../ports';
import { formatReadingValue } from './formatReadingValue';
import { pulseSeriesFor } from './pulseSeries';

/** Days of simulated history; "tu normal" needs the first 14 (RN3). */
export const SEED_DAYS = 14;
/** Fixed PRNG seed: the variation is the same on every run. */
const SEED = 20261115;
/** Linear congruential generator (32-bit, Numerical Recipes constants). */
const LCG = { multiplier: 1664525, increment: 1013904223, modulus: 4294967296 };
/** Nights before today that come from the scenario, not from the Sleep-EDF file. */
const PRIOR_NIGHTS = 2;
/** Mood choices on a seeded day: 4 or 5. */
const MOOD_CHOICES = 2;
/** Fewest WESAD values in band that are used as the pulse series. */
const MIN_SERIES_VALUES = 2;
/** Sleep observations take 0.5 h steps (RN4). */
const SLEEP_STEP_HOURS = 0.5;
/** Largest variation around the centre value, in steps of its unit (see SOURCES.md). */
const PULSE_BOUND = 3;
const SYSTOLIC_BOUND = 4;
const DIASTOLIC_BOUND = 3;
const TEMPERATURE_STEP = 0.1;
const TEMPERATURE_BOUND = 2;
const OXYGEN_BOUND = 1;
/** Mood of the seeded days: 4 or 5 (green). */
const MOOD_LOW = 4;
/** Time of the seeded check-ins, local: a fixed morning time. */
const CHECK_HOUR = 9;
const CHECK_MINUTE = 30;
const NORMAL = DEMO_SCENARIOS.normal.devices;

export interface SeedOptions {
  /** Clock reading; the seeded days are the `SEED_DAYS` local days before it. */
  now: Date;
  /** WESAD resting pulse series (bpm), when `data/wesad-hr.json` is present. */
  wesadSeries?: number[];
}

/** Fixed-seed PRNG returning values in [0, 1): the same seed gives the same sequence. */
export function seededRandom(seed: number): () => number {
  let state = seed % LCG.modulus;
  return () => {
    state = (LCG.multiplier * state + LCG.increment) % LCG.modulus;
    return state / LCG.modulus;
  };
}

/** Integer in [-bound, bound]. */
function jitter(rng: () => number, bound: number): number {
  const choices = bound + bound + 1;
  return Math.floor(rng() * choices) - bound;
}

/** Rounds to one decimal, which removes float drift from `centre + k * step`. */
function snap(value: number): number {
  return Number(value.toFixed(1));
}

function isGreen(indicator: Indicator, value: number | BloodPressure): boolean {
  return levelFor(indicator, value).level === 'green';
}

/**
 * The scenario value when it is green, else the normal scenario's value: the seeded days stand for
 * the usual days, so they stay green (the scenario value is for today only). `null` when neither
 * has a value (the sensor sends nothing).
 */
function greenCentre<T>(
  scenarioValue: T | null,
  normalValue: T | null,
  isGreenValue: (value: T) => boolean,
): T | null {
  if (scenarioValue !== null && isGreenValue(scenarioValue)) return scenarioValue;
  return normalValue ?? scenarioValue;
}

/**
 * A value within `bound` steps of `centre`. When that value is not green, the mirror image is used
 * (still within the bound), so the seeded days stay green.
 */
function nearGreen(
  indicator: Indicator,
  centre: number,
  step: number,
  bound: number,
  rng: () => number,
): number {
  const steps = jitter(rng, bound);
  const candidate = snap(centre + steps * step);
  return isGreen(indicator, candidate) ? candidate : snap(centre - steps * step);
}

/** Blood pressure within the bounds; systolic and diastolic are mirrored together when not green. */
function pressureNear(centre: BloodPressure, rng: () => number): BloodPressure {
  const systolicSteps = jitter(rng, SYSTOLIC_BOUND);
  const diastolicSteps = jitter(rng, DIASTOLIC_BOUND);
  const direct = {
    systolic: centre.systolic + systolicSteps,
    diastolic: centre.diastolic + diastolicSteps,
  };
  if (isGreen('blood_pressure', direct)) return direct;
  return {
    systolic: centre.systolic - systolicSteps,
    diastolic: centre.diastolic - diastolicSteps,
  };
}

/** Sleep hours in 0.5 h steps, rounded down: a value below 7 h stays below 7 h (RN1). */
function halfHourFloor(hours: number): number {
  return Math.floor(hours / SLEEP_STEP_HOURS) * SLEEP_STEP_HOURS;
}

/**
 * Sleep of the seeded days, oldest first: the Sleep-EDF nights, with the last two replaced by
 * `priorNights`, which are listed as [yesterday, the day before] (demoScenarios.ts).
 */
function sleepSeries(priorNights: readonly number[]): number[] {
  const [yesterday, dayBefore] = priorNights;
  return [...sleepHistory.hours.slice(0, SEED_DAYS - PRIOR_NIGHTS), dayBefore, yesterday].map(halfHourFloor);
}

/** Local 09:30 of the day `daysAgo` days before `now`. */
function checkTime(now: Date, daysAgo: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, CHECK_HOUR, CHECK_MINUTE);
}

/** Values of one seeded day, before they become observations. */
interface DayValues {
  sleep: number;
  mood: number;
  pulse: number | null;
  pressure: BloodPressure | null;
  temperature: number | null;
  oxygen: number | null;
}

/** Pulse of one day: a WESAD value when the series has at least two in band, else scenario ±3. */
function pulseOf(pulses: readonly number[], centre: number | null, rng: () => number): number | null {
  if (pulses.length >= MIN_SERIES_VALUES) return pulses[Math.floor(rng() * pulses.length)];
  return centre === null ? null : centre + jitter(rng, PULSE_BOUND);
}

/**
 * Observations of one seeded day. Every seeded value is simulated (the whole history is): voice values
 * are confirmed (Principle IX), device values come from the simulated devices.
 */
function observationsOf(at: string, day: DayValues): Observation[] {
  const voice = (indicator: string, value: unknown) =>
    Observation.parse({ indicator, value, source: 'voice', confirmed: true, simulated: true, at });
  const device = (indicator: string, value: unknown) =>
    Observation.parse({ indicator, value, source: 'device', confirmed: true, simulated: true, at });
  const observations = [voice('sleep_hours', day.sleep), voice('mood', day.mood)];
  if (day.pulse !== null) observations.push(device('resting_heart_rate', day.pulse));
  if (day.pressure !== null) observations.push(device('blood_pressure', day.pressure));
  if (day.temperature !== null) observations.push(device('body_temperature', day.temperature));
  if (day.oxygen !== null) observations.push(device('oxygen_saturation', day.oxygen));
  return observations;
}

/**
 * The 14 simulated check-ins before `options.now`, oldest first. Every record has `simulated: true`
 * and is valid against `CheckRecord`. Sleep is the Sleep-EDF nights (last two = `priorNights`);
 * pulse, blood pressure, temperature and SpO₂ vary around the scenario values; mood is 4 or 5.
 */
export function buildSeedHistory(scenario: DemoScenario, options: SeedOptions): CheckRecord[] {
  const rng = seededRandom(SEED);
  const sleep = sleepSeries(scenario.priorNights);
  const pulses = pulseSeriesFor(scenario, options.wesadSeries);
  const pressureCentre = greenCentre(scenario.devices.blood_pressure, NORMAL.blood_pressure, (bp) =>
    isGreen('blood_pressure', bp),
  );
  const temperatureCentre = greenCentre(scenario.devices.body_temperature, NORMAL.body_temperature, (value) =>
    isGreen('body_temperature', value),
  );
  const oxygenCentre = greenCentre(scenario.devices.oxygen_saturation, NORMAL.oxygen_saturation, (value) =>
    isGreen('oxygen_saturation', value),
  );
  const newestFirst: CheckRecord[] = [];
  for (let index = 0; index < SEED_DAYS; index += 1) {
    const day: DayValues = {
      sleep: sleep[index],
      mood: MOOD_LOW + Math.floor(rng() * MOOD_CHOICES),
      pulse: pulseOf(pulses, scenario.devices.resting_heart_rate, rng),
      pressure: pressureCentre === null ? null : pressureNear(pressureCentre, rng),
      temperature:
        temperatureCentre === null
          ? null
          : nearGreen('body_temperature', temperatureCentre, TEMPERATURE_STEP, TEMPERATURE_BOUND, rng),
      oxygen:
        oxygenCentre === null
          ? null
          : nearGreen('oxygen_saturation', oxygenCentre, 1, OXYGEN_BOUND, rng),
    };
    const at = checkTime(options.now, SEED_DAYS - index).toISOString();
    const observations = observationsOf(at, day);
    const evaluation = evaluateCheck({
      observations,
      symptoms: [],
      history: newestFirst,
      formatValue: formatReadingValue,
    });
    const record = CheckRecord.parse({
      id: at,
      observations,
      symptoms: [],
      readings: evaluation.readings,
      verdict: evaluation.verdict,
      actionKey: evaluation.actionKey,
      simulated: true,
    });
    newestFirst.unshift(record);
  }
  return newestFirst.reverse();
}

/** Writes the seeded history only when the store is empty (startup). */
export async function seedIfEmpty(
  repository: CheckRepositoryPort,
  scenario: DemoScenario,
  options: SeedOptions,
): Promise<void> {
  await repository.seedIfEmpty(buildSeedHistory(scenario, options));
}

/** Scenario change (FR-013): clears the store, then writes the seeded history of the new scenario. */
export async function reseedScenario(
  repository: CheckRepositoryPort,
  scenario: DemoScenario,
  options: SeedOptions,
): Promise<void> {
  await repository.clear();
  await repository.seedIfEmpty(buildSeedHistory(scenario, options));
}
