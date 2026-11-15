/**
 * RN5 / RN6 / CL2 verdict and action checks (T063). Implemented in T068,
 * `src/verdict.ts` and `src/evaluateCheck.ts`.
 *
 * Expected API:
 *
 *   evaluateCheck(input: {
 *     observations: readonly Observation[];
 *     symptoms: readonly Symptom[];
 *     history: readonly CheckRecord[]; // previous days, newest first
 *   }): {
 *     readings: Record<SensorKey, SensorReading>;
 *     verdict: Verdict;
 *     actionKey: string; // FULL message key, e.g. 'action.slept_little'; the runner speaks it as-is
 *   }
 *
 * - A sensor whose indicators have no observation has level `unknown` (CL2).
 * - `actionKey` is `''` when the verdict is `ok` (messages.es.ts has no `action.ok`).
 * - Action priority (first match wins): red > fever > two amber > single amber > symptom >
 *   outside normal > in doubt > missing data. `single amber` is `action.slept_little` when the
 *   single amber is sleep_hours, otherwise `action.single_amber`.
 *
 * `outsideNormal` stays false until US4, so the "symptom > outside normal" and
 * "outside normal > in doubt" pairs are not tested here.
 */
import { describe, it, expect } from 'vitest';
import { Observation, type Symptom } from '@base-vital/contracts';
import { evaluateCheck } from '../src/evaluateCheck';

const AT = '2026-11-15T07:00:00.000Z';

// Fixtures are built with the contracts schema, so they are valid by construction.
// Voice values are confirmed (Principle IX); device values are simulated in this version.
const voice = (indicator: 'sleep_hours' | 'mood', value: number) =>
  Observation.parse({ indicator, value, source: 'voice', confirmed: true, simulated: false, at: AT });

const device = (
  indicator: 'resting_heart_rate' | 'blood_pressure' | 'body_temperature' | 'oxygen_saturation',
  value: number | { systolic: number; diastolic: number },
) => Observation.parse({ indicator, value, source: 'device', confirmed: true, simulated: true, at: AT });

const sleep = (hours: number) => voice('sleep_hours', hours);
const mood = (value: number) => voice('mood', value);
const pressure = (systolic: number, diastolic: number) =>
  device('blood_pressure', { systolic, diastolic });
const pulse = (bpm: number) => device('resting_heart_rate', bpm);
const temperature = (celsius: number) => device('body_temperature', celsius);
const oxygen = (percent: number) => device('oxygen_saturation', percent);

/** Every indicator in a healthy range: sleep 7.5 h, mood 5, 118/76, 72 bpm, 36.8 °C, 97 %. */
const allGreen = () => [sleep(7.5), mood(5), pressure(118, 76), pulse(72), temperature(36.8), oxygen(97)];

/** Drops every observation of one indicator, leaving the rest as they are. */
const without = (observations: Observation[], indicator: Observation['indicator']) =>
  observations.filter((observation) => observation.indicator !== indicator);

const NO_SYMPTOMS: Symptom[] = [];

/** The rules layer takes no display text; these tests do not look at `value`. */
const TRIVIAL_FORMAT = () => '';

const run = (observations: Observation[], symptoms: Symptom[] = NO_SYMPTOMS) =>
  evaluateCheck({ observations, symptoms, history: [], formatValue: TRIVIAL_FORMAT });

describe('evaluateCheck verdict (RN5, CL2)', () => {
  it('all green gives ok with an empty action key', () => {
    const result = run(allGreen());

    expect(result.verdict).toBe('ok');
    expect(result.actionKey).toBe('');
    expect(result.readings.sleep.level).toBe('green');
    expect(result.readings.pulse.level).toBe('green');
    expect(result.readings.pressure.level).toBe('green');
    expect(result.readings.temperature.level).toBe('green');
    expect(result.readings.oxygen.level).toBe('green');
  });

  it('sleep 5 h with the rest green gives attention with action.slept_little', () => {
    const result = run(without(allGreen(), 'sleep_hours').concat(sleep(5)));

    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.slept_little');
    expect(result.readings.sleep.level).toBe('amber');
    expect(result.readings.sleep.reason).toBe('sleep_hours');
  });

  it('missing blood pressure with the rest green gives attention with action.missing_data, never ok (CL2)', () => {
    const result = run(without(allGreen(), 'blood_pressure'));

    expect(result.verdict).toBe('attention');
    expect(result.verdict).not.toBe('ok');
    expect(result.actionKey).toBe('action.missing_data');
    expect(result.readings.pressure.level).toBe('unknown');
  });

  it('two amber values on one sensor (sleep 5 h + mood 3) give alert with action.two_amber', () => {
    const result = run(without(without(allGreen(), 'sleep_hours'), 'mood').concat(sleep(5), mood(3)));

    expect(result.verdict).toBe('alert');
    expect(result.actionKey).toBe('action.two_amber');
    expect(result.readings.sleep.level).toBe('amber');
  });

  it('two amber values on different sensors (sleep 5 h + blood pressure 128/76) give alert with action.two_amber', () => {
    const result = run(without(without(allGreen(), 'sleep_hours'), 'blood_pressure').concat(sleep(5), pressure(128, 76)));

    expect(result.verdict).toBe('alert');
    expect(result.actionKey).toBe('action.two_amber');
  });

  it('one amber and one in_doubt value (temp 35.6) give attention', () => {
    const result = run(without(without(allGreen(), 'sleep_hours'), 'body_temperature').concat(sleep(5), temperature(35.6)));

    expect(result.verdict).toBe('attention');
    expect(result.readings.temperature.level).toBe('in_doubt');
  });

  it('any red value gives alert with action.red', () => {
    const result = run(without(allGreen(), 'oxygen_saturation').concat(oxygen(88)));

    expect(result.verdict).toBe('alert');
    expect(result.actionKey).toBe('action.red');
    expect(result.readings.oxygen.level).toBe('red');
  });

  it('temperature 38.2 gives alert with action.fever, which outranks the generic red', () => {
    const result = run(without(allGreen(), 'body_temperature').concat(temperature(38.2)));

    expect(result.verdict).toBe('alert');
    expect(result.actionKey).toBe('action.fever');
    expect(result.readings.temperature.level).toBe('red');
  });

  it.each(['dizziness', 'fainting', 'chest_pain', 'shortness_of_breath'] as const)(
    'all green with symptom %s gives attention with action.symptom',
    (symptom) => {
      const result = run(allGreen(), [symptom]);

      expect(result.verdict).toBe('attention');
      expect(result.actionKey).toBe('action.symptom');
    },
  );
});

describe('evaluateCheck sensor reason and team criterion (RN6, Principle VIII)', () => {
  it('sleep sensor reason is mood when mood sets the level (sleep 7.5 + mood 3)', () => {
    const result = run(without(without(allGreen(), 'sleep_hours'), 'mood').concat(sleep(7.5), mood(3)));

    expect(result.readings.sleep.level).toBe('amber');
    expect(result.readings.sleep.reason).toBe('mood');
    expect(result.readings.sleep.teamCriterion).toBe(true);
    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.single_amber');
  });

  it('sleep sensor reason is sleep_hours when sleep sets the level (sleep 5 + mood 5)', () => {
    const result = run(without(without(allGreen(), 'sleep_hours'), 'mood').concat(sleep(5), mood(5)));

    expect(result.readings.sleep.level).toBe('amber');
    expect(result.readings.sleep.reason).toBe('sleep_hours');
    expect(result.readings.sleep.teamCriterion).toBe(false);
  });
});

describe('evaluateCheck action priority (red > fever > two amber > single amber > symptom > in doubt > missing data)', () => {
  it('fever outranks two amber (temp 38.2, sleep 5 h, mood 3)', () => {
    const result = run(
      without(without(without(allGreen(), 'body_temperature'), 'sleep_hours'), 'mood').concat(
        temperature(38.2),
        sleep(5),
        mood(3),
      ),
    );

    expect(result.verdict).toBe('alert');
    expect(result.actionKey).toBe('action.fever');
  });

  it('two amber outranks single amber (sleep 5 h, mood 3, rest green)', () => {
    const result = run(without(without(allGreen(), 'sleep_hours'), 'mood').concat(sleep(5), mood(3)));

    expect(result.actionKey).toBe('action.two_amber');
  });

  it('single amber outranks symptom (sleep 5 h + dizziness)', () => {
    const result = run(without(allGreen(), 'sleep_hours').concat(sleep(5)), ['dizziness']);

    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.slept_little');
  });

  it('symptom outranks in doubt (temp 35.6 + chest_pain)', () => {
    const result = run(without(allGreen(), 'body_temperature').concat(temperature(35.6)), ['chest_pain']);

    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.symptom');
  });

  it('in doubt outranks missing data (temp 35.6 + blood pressure missing)', () => {
    const result = run(without(without(allGreen(), 'body_temperature'), 'blood_pressure').concat(temperature(35.6)));

    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.in_doubt');
  });

  it('amber outranks missing data (sleep 5 h + blood pressure missing gives slept_little)', () => {
    const result = run(without(without(allGreen(), 'sleep_hours'), 'blood_pressure').concat(sleep(5)));

    expect(result.verdict).toBe('attention');
    expect(result.actionKey).toBe('action.slept_little');
  });
});

describe('evaluateCheck action team criterion (Principle VIII)', () => {
  it('sleep 5 h + mood 3 gives action.two_amber with actionTeamCriterion true (mood)', () => {
    const result = run(without(without(allGreen(), 'sleep_hours'), 'mood').concat(sleep(5), mood(3)));

    expect(result.actionKey).toBe('action.two_amber');
    expect(result.actionTeamCriterion).toBe(true);
  });

  it('pulse 55 gives action.single_amber with actionTeamCriterion true (pulse team criterion)', () => {
    const result = run(without(allGreen(), 'resting_heart_rate').concat(pulse(55)));

    expect(result.actionKey).toBe('action.single_amber');
    expect(result.actionTeamCriterion).toBe(true);
  });

  it('BP 140/85 + mood 3 gives action.red with actionTeamCriterion false (red BP is not a team criterion)', () => {
    const result = run(
      without(without(allGreen(), 'blood_pressure'), 'mood').concat(pressure(140, 85), mood(3)),
    );

    expect(result.actionKey).toBe('action.red');
    expect(result.actionTeamCriterion).toBe(false);
  });

  it('sleep 5 h alone gives action.slept_little with actionTeamCriterion false', () => {
    const result = run(without(allGreen(), 'sleep_hours').concat(sleep(5)));

    expect(result.actionKey).toBe('action.slept_little');
    expect(result.actionTeamCriterion).toBe(false);
  });

  it('an all-green check has actionTeamCriterion false', () => {
    expect(run(allGreen()).actionTeamCriterion).toBe(false);
  });
});

describe('evaluateCheck missing sensor and display values', () => {
  it('names the first sensor with no reading when the action is missing data', () => {
    const result = run(without(allGreen(), 'blood_pressure'));

    expect(result.actionKey).toBe('action.missing_data');
    expect(result.missingSensor).toBe('pressure');
  });

  it('missingSensor is null when the action is not missing data', () => {
    expect(run(allGreen()).missingSensor).toBeNull();
    expect(run(without(allGreen(), 'sleep_hours').concat(sleep(5))).missingSensor).toBeNull();
  });

  it('takes each reading value from formatValue, which gets the primary observation or undefined', () => {
    const seen: Array<[string, string | undefined]> = [];
    const result = evaluateCheck({
      observations: without(allGreen(), 'blood_pressure'),
      symptoms: NO_SYMPTOMS,
      history: [],
      formatValue: (indicator, observation) => {
        seen.push([indicator, observation?.indicator]);
        return observation === undefined ? 'sin dato' : `${indicator}!`;
      },
    });

    expect(result.readings.sleep.value).toBe('sleep_hours!');
    expect(result.readings.pulse.value).toBe('resting_heart_rate!');
    expect(result.readings.pressure.value).toBe('sin dato');
    expect(seen).toContainEqual(['blood_pressure', undefined]);
  });
});
