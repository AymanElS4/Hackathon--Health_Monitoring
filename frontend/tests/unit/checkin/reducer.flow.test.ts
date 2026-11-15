/**
 * Flow tests for the daily check-in reducer (T042). Written before T048; must FAIL until T048.
 *
 * Expected API (implemented by T048):
 *
 *   // frontend/src/domain/checkin/types.ts  (types only)
 *   import type { Indicator, Observation, SensorKey, Verdict } from '@base-vital/contracts';
 *
 *   export type StepKind = 'sleep' | 'mood' | 'symptoms' | 'confirm' | 'none'; // parseUtterance kind (T041)
 *   export type StepId =
 *     | 'greeting' | 'ask_sleep' | 'ask_mood' | 'ask_symptoms'
 *     | 'measuring' | 'summary' | 'next_activity';          // US2 adds confirm_* ids
 *   export interface CheckinStep {
 *     id: StepId;
 *     kind: 'say' | 'ask' | 'measure' | 'summary' | 'next';
 *     messageKey: string;
 *     parse?: StepKind;
 *     grammar?: readonly string[];
 *     focus?: SensorKey | null;
 *     indicator?: Indicator;
 *   }
 *   export type CheckinScript = readonly CheckinStep[];
 *
 *   export type CheckinEvent =
 *     | { type: 'start' }
 *     | { type: 'transcript'; text: string | null }
 *     | { type: 'spoken' }
 *     | { type: 'devicesRead'; observations: Observation[] }   // one device per measuring stage
 *     | { type: 'evaluated'; result: { verdict: Verdict; actionKey: string } }
 *     | { type: 'saved' }
 *     | { type: 'pause' } | { type: 'resume' } | { type: 'repeat' };
 *
 *   export type Effect =
 *     | { type: 'speak'; key: string; params?: Record<string, unknown> }
 *     | { type: 'listen'; grammar: readonly string[] }
 *     | { type: 'setFocus'; sensor: SensorKey | null }
 *     | { type: 'readDevices'; indicators: readonly Indicator[] }
 *     | { type: 'evaluate' }
 *     | { type: 'save' }
 *     | { type: 'showButtons'; step: StepId };
 *
 *   // frontend/src/domain/checkin/checkinReducer.ts
 *   export interface CheckinState {
 *     step: StepId | 'idle' | 'evaluating' | 'saved';
 *     paused: boolean;
 *     script: CheckinScript;   // the script is a parameter; the domain never imports config/
 *   }
 *   export function createCheckinState(input: { script: CheckinScript }): CheckinState;
 *   export function checkinReducer(
 *     state: CheckinState,
 *     event: CheckinEvent,
 *   ): { state: CheckinState; effects: Effect[] };
 *
 * Effects run in order by the runner (speak resolves before the next effect runs).
 * `parseUtterance` may be called by the reducer; these tests only observe it indirectly.
 */
import { describe, it, expect } from 'vitest';
import type { Indicator, Observation } from '@base-vital/contracts';
import { TEMP_IN_DOUBT_BAND } from '@base-vital/health-rules';
import type { CheckinEvent, CheckinScript, Effect } from '../../../src/domain/checkin/types';
import type { CheckinState } from '../../../src/domain/checkin/checkinReducer';
import {
  checkinReducer,
  createCheckinState,
} from '../../../src/domain/checkin/checkinReducer';

// ---------------------------------------------------------------------------
// Script fixture (mirrors contracts/checkin-script.md; confirm steps come in US2)
// ---------------------------------------------------------------------------

const CONTROL = ['para', 'sigue', 'repite'];
const sleepGrammar = [...Array.from({ length: 25 }, (_, i) => String(i)), 'y media', ...CONTROL, '[unk]'];
const moodGrammar = ['1', '2', '3', '4', '5', 'mal', 'bien', 'muy bien', ...CONTROL, '[unk]'];
const symptomsGrammar = [
  'mareo', 'desmayo', 'dolor de pecho', 'falta de aire', 'no', 'ninguno', ...CONTROL, '[unk]',
];
const nextGrammar = ['sí', ...CONTROL, '[unk]'];

const script: CheckinScript = [
  { id: 'greeting', kind: 'say', messageKey: 'greet' },
  {
    id: 'ask_sleep',
    kind: 'ask',
    messageKey: 'ask.sleep',
    parse: 'sleep',
    grammar: { es: sleepGrammar, en: sleepGrammar },
    focus: 'sleep',
    indicator: 'sleep_hours',
  },
  {
    id: 'ask_mood',
    kind: 'ask',
    messageKey: 'ask.mood',
    parse: 'mood',
    grammar: { es: moodGrammar, en: moodGrammar },
    focus: 'sleep',
    indicator: 'mood',
  },
  {
    id: 'ask_symptoms',
    kind: 'ask',
    messageKey: 'ask.symptoms',
    parse: 'symptoms',
    grammar: { es: symptomsGrammar, en: symptomsGrammar },
    focus: null,
  },
  { id: 'measuring', kind: 'measure', messageKey: 'measure' },
  { id: 'summary', kind: 'summary', messageKey: 'verdict' },
  { id: 'next_activity', kind: 'next', messageKey: 'next', grammar: { es: nextGrammar, en: nextGrammar }, focus: null },
];

// ---------------------------------------------------------------------------
// Event and observation helpers
// ---------------------------------------------------------------------------

const at = '2026-11-15T09:20:00.000Z';
const tx = (text: string | null): CheckinEvent => ({ type: 'transcript', text });
const read = (observation: Observation): CheckinEvent => ({
  type: 'devicesRead',
  observations: [observation],
});

const bloodPressure: Observation = {
  indicator: 'blood_pressure',
  value: { systolic: 118, diastolic: 76 },
  source: 'device',
  confirmed: true,
  simulated: true,
  at,
};
const pulse: Observation = {
  indicator: 'resting_heart_rate',
  value: 64,
  source: 'device',
  confirmed: true,
  simulated: true,
  at,
};
const oxygen: Observation = {
  indicator: 'oxygen_saturation',
  value: 98,
  source: 'device',
  confirmed: true,
  simulated: true,
  at,
};
const temperature: Observation = {
  indicator: 'body_temperature',
  value: 36.6,
  source: 'device',
  confirmed: true,
  simulated: true,
  at,
};
const deviceReads: CheckinEvent[] = [read(bloodPressure), read(pulse), read(oxygen), read(temperature)];

/** Runs events from a given state, returning the final state and every effect emitted. */
function runFrom(start: CheckinState, events: readonly CheckinEvent[]) {
  let state = start;
  const effects: Effect[] = [];
  for (const event of events) {
    const result = checkinReducer(state, event);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

/** Runs events in order from a fresh state built with the fixture script. */
function run(events: readonly CheckinEvent[]) {
  return runFrom(createCheckinState({ script }), events);
}

/** Ordered focus and device-read trace, e.g. `focus:pulse`, `read:resting_heart_rate`. */
function deviceTrace(effects: readonly Effect[]): string[] {
  return effects.flatMap((effect): string[] => {
    if (effect.type === 'setFocus' && effect.sensor !== null) return [`focus:${effect.sensor}`];
    if (effect.type === 'readDevices') return effect.indicators.map((i: Indicator) => `read:${i}`);
    return [];
  });
}

// Event prefixes that reach each listening step from idle.
const TO_ASK_SLEEP: CheckinEvent[] = [{ type: 'start' }, { type: 'spoken' }];
const TO_ASK_MOOD: CheckinEvent[] = [...TO_ASK_SLEEP, tx('7')];
const TO_ASK_SYMPTOMS: CheckinEvent[] = [...TO_ASK_MOOD, tx('4')];
const TO_NEXT_ACTIVITY: CheckinEvent[] = [
  ...TO_ASK_SYMPTOMS,
  tx('ninguno'),
  ...deviceReads,
  { type: 'evaluated', result: { verdict: 'attention', actionKey: 'action.slept_little' } },
  { type: 'spoken' },
  { type: 'spoken' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkin reducer flow', () => {
  it('starts in idle', () => {
    expect(createCheckinState({ script }).step).toBe('idle');
  });

  it('walks greeting → ask_sleep → ask_mood → ask_symptoms → measuring → evaluating → summary → next_activity → saved', () => {
    let state = createCheckinState({ script });

    const start = checkinReducer(state, { type: 'start' });
    state = start.state;
    expect(state.step).toBe('greeting');
    expect(start.effects).toContainEqual({ type: 'speak', key: 'greet' });

    const greeted = checkinReducer(state, { type: 'spoken' });
    state = greeted.state;
    expect(state.step).toBe('ask_sleep');

    const sleepAnswered = checkinReducer(state, tx('7'));
    state = sleepAnswered.state;
    expect(state.step).toBe('ask_mood');

    const moodAnswered = checkinReducer(state, tx('4'));
    state = moodAnswered.state;
    expect(state.step).toBe('ask_symptoms');

    const symptomsAnswered = checkinReducer(state, tx('ninguno'));
    state = symptomsAnswered.state;
    expect(state.step).toBe('measuring');
    expect(symptomsAnswered.effects).toContainEqual({ type: 'speak', key: 'measure' });

    const measured = deviceReads.reduce(
      (acc, event) => {
        const result = checkinReducer(acc.state, event);
        return { state: result.state, effects: [...acc.effects, ...result.effects] };
      },
      { state: symptomsAnswered.state, effects: [] as Effect[] },
    );
    state = measured.state;
    expect(state.step).toBe('evaluating');
    expect(measured.effects).toContainEqual({ type: 'evaluate' });

    const evaluated = checkinReducer(state, {
      type: 'evaluated',
      result: { verdict: 'attention', actionKey: 'action.slept_little' },
    });
    state = evaluated.state;
    expect(state.step).toBe('summary');
    expect(evaluated.effects).toContainEqual({ type: 'speak', key: 'verdict.attention' });
    expect(evaluated.effects).toContainEqual({ type: 'speak', key: 'action.slept_little' });

    const verdictSpoken = checkinReducer(state, { type: 'spoken' });
    state = verdictSpoken.state;
    expect(state.step).toBe('summary');
    expect(verdictSpoken.effects).toEqual([]);

    const summarized = checkinReducer(state, { type: 'spoken' });
    state = summarized.state;
    expect(state.step).toBe('next_activity');
    expect(summarized.effects).toContainEqual({ type: 'speak', key: 'next' });
    expect(summarized.effects).toContainEqual({ type: 'listen', grammar: nextGrammar });

    const confirmedNext = checkinReducer(state, tx('sí'));
    state = confirmedNext.state;
    expect(confirmedNext.effects).toContainEqual({ type: 'save' });

    const saved = checkinReducer(state, { type: 'saved' });
    expect(saved.state.step).toBe('saved');
  });

  it('ask_sleep emits setFocus(sleep), speak(ask.sleep) and listen(sleepGrammar), in that order', () => {
    const { effects, state } = run(TO_ASK_SLEEP);
    expect(state.step).toBe('ask_sleep');
    expect(effects.slice(-3)).toEqual([
      { type: 'setFocus', sensor: 'sleep' },
      { type: 'speak', key: 'ask.sleep' },
      { type: 'listen', grammar: sleepGrammar },
    ]);
  });

  it('measuring reads pressure → pulse → oxygen → temperature, each with a setFocus', () => {
    // Only the measuring-phase events are traced, so the sleep focus from the ask steps is excluded.
    const atSymptoms = run(TO_ASK_SYMPTOMS).state;
    const { effects } = runFrom(atSymptoms, [tx('ninguno'), ...deviceReads]);

    expect(deviceTrace(effects)).toEqual([
      'focus:pressure', 'read:blood_pressure',
      'focus:pulse', 'read:resting_heart_rate',
      'focus:oxygen', 'read:oxygen_saturation',
      'focus:temperature', 'read:body_temperature',
    ]);
  });

  it('does not start reading devices before the symptoms step is answered', () => {
    const { effects, state } = run(TO_ASK_SYMPTOMS);
    expect(state.step).toBe('ask_symptoms');
    expect(effects.some((e) => e.type === 'readDevices')).toBe(false);
  });

  describe.each([
    { step: 'ask_sleep', events: TO_ASK_SLEEP, promptKey: 'ask.sleep', grammar: sleepGrammar },
    { step: 'ask_mood', events: TO_ASK_MOOD, promptKey: 'ask.mood', grammar: moodGrammar },
    { step: 'ask_symptoms', events: TO_ASK_SYMPTOMS, promptKey: 'ask.symptoms', grammar: symptomsGrammar },
    { step: 'next_activity', events: TO_NEXT_ACTIVITY, promptKey: 'next', grammar: nextGrammar },
  ])('control words in $step', ({ step, events, promptKey, grammar }) => {
    it('pause keeps the step and listens for control words only', () => {
      const reached = run(events);
      expect(reached.state.step).toBe(step);

      const paused = checkinReducer(reached.state, { type: 'pause' });
      expect(paused.state.step).toBe(step);
      expect(paused.state.paused).toBe(true);
      expect(paused.effects).toEqual([{ type: 'listen', grammar }]);
    });

    it('"para" pauses and "sigue" resumes by voice', () => {
      const reached = run(events);

      const paused = checkinReducer(reached.state, tx('para'));
      expect(paused.state.paused).toBe(true);
      expect(paused.effects).toEqual([{ type: 'listen', grammar }]);

      const resumed = checkinReducer(paused.state, tx('sigue'));
      expect(resumed.state.step).toBe(step);
      expect(resumed.state.paused).toBe(false);
      expect(resumed.effects).toEqual([{ type: 'listen', grammar }]);
    });

    it('while paused, "repite" speaks the prompt and listens again without resuming', () => {
      const paused = checkinReducer(run(events).state, { type: 'pause' });

      const repeated = checkinReducer(paused.state, tx('repite'));
      expect(repeated.state.paused).toBe(true);
      expect(repeated.effects).toEqual([
        { type: 'speak', key: promptKey },
        { type: 'listen', grammar },
      ]);
    });

    it('while paused, any other answer re-listens and stays paused', () => {
      const paused = checkinReducer(run(events).state, { type: 'pause' });

      const heard = checkinReducer(paused.state, tx('mareo bla'));
      expect(heard.state.paused).toBe(true);
      expect(heard.state.step).toBe(step);
      expect(heard.effects).toEqual([{ type: 'listen', grammar }]);
    });

    it('resume re-listens with the step grammar', () => {
      const paused = checkinReducer(run(events).state, { type: 'pause' });

      const resumed = checkinReducer(paused.state, { type: 'resume' });
      expect(resumed.state.step).toBe(step);
      expect(resumed.state.paused).toBe(false);
      expect(resumed.effects).toContainEqual({ type: 'listen', grammar });
    });

    it('repeat re-speaks the current prompt and listens again', () => {
      const reached = run(events);

      const repeated = checkinReducer(reached.state, { type: 'repeat' });
      expect(repeated.state.step).toBe(step);
      expect(repeated.effects).toContainEqual({ type: 'speak', key: promptKey });
      expect(repeated.effects).toContainEqual({ type: 'listen', grammar });
    });
  });
});

describe('summary speech', () => {
  const EVALUATION = { verdict: 'attention', actionKey: 'action.slept_little' } as const;

  it('speaks the verdict and the action, and advances only after the action is spoken', () => {
    const evaluated = run([...TO_ASK_SYMPTOMS, tx('ninguno'), ...deviceReads, { type: 'evaluated', result: EVALUATION }]);
    expect(evaluated.state.step).toBe('summary');
    expect(evaluated.state.pendingSpeech).toBe(2);

    const afterVerdict = checkinReducer(evaluated.state, { type: 'spoken' });
    expect(afterVerdict.state.step).toBe('summary');
    expect(afterVerdict.state.pendingSpeech).toBe(1);
    expect(afterVerdict.effects).toEqual([]);

    const afterAction = checkinReducer(afterVerdict.state, { type: 'spoken' });
    expect(afterAction.state.step).toBe('next_activity');
    expect(afterAction.state.pendingSpeech).toBe(0);
    expect(afterAction.effects).toContainEqual({ type: 'speak', key: 'next' });
  });

  it('skips the action line when the action key is empty', () => {
    const evaluated = run([
      ...TO_ASK_SYMPTOMS,
      tx('ninguno'),
      ...deviceReads,
      { type: 'evaluated', result: { verdict: 'ok', actionKey: '' } },
    ]);
    expect(evaluated.effects).toContainEqual({ type: 'speak', key: 'verdict.ok' });
    expect(evaluated.state.pendingSpeech).toBe(1);

    const advanced = checkinReducer(evaluated.state, { type: 'spoken' });
    expect(advanced.state.step).toBe('next_activity');
  });
});

// ---------------------------------------------------------------------------
// RN1 low-temperature re-read (T069; implemented by T070)
//
// A body temperature inside TEMP_IN_DOUBT_BAND ([35.0, 36.1) °C) is read once more before
// evaluation. T070 adds to CheckinState the field `remeasured: Indicator[]` (initial value `[]`):
// the indicators whose extra read was requested because the first value was in doubt.
// It is set when the second read is requested and kept for evaluation (in_doubt).
// ---------------------------------------------------------------------------

/** CheckinState as T070 extends it (`remeasured` does not exist yet). */
type RemeasuringState = CheckinState & { remeasured: Indicator[] };

const remeasuredOf = (state: CheckinState): Indicator[] => (state as RemeasuringState).remeasured;

describe('RN1 low-temperature re-read', () => {
  const temperatureAt = (value: number): Observation => ({ ...temperature, value });
  const temperatureRead = (value: number): CheckinEvent => read(temperatureAt(value));

  // Measuring reached with the temperature stage next (deviceIndex 3).
  const atTemperatureStage = run([
    ...TO_ASK_SYMPTOMS,
    tx('ninguno'),
    read(bloodPressure),
    read(pulse),
    read(oxygen),
  ]).state;

  const temperatureReads = (observations: readonly Observation[]) =>
    observations.filter((o) => o.indicator === 'body_temperature');

  it('a first temperature in doubt (35,6 °C) triggers one extra thermometer read instead of evaluating', () => {
    const result = runFrom(atTemperatureStage, [temperatureRead(35.6)]);

    expect(result.state.step).toBe('measuring');
    expect(result.effects).toEqual([
      { type: 'speak', key: 'measure.temperature.again' },
      { type: 'setFocus', sensor: 'temperature' },
      { type: 'readDevices', indicators: ['body_temperature'] },
    ]);
    expect(result.effects).not.toContainEqual({ type: 'evaluate' });
  });

  it('a second reading still in doubt (35,6 °C again) proceeds to evaluating and keeps the temperature flagged', () => {
    const afterFirst = runFrom(atTemperatureStage, [temperatureRead(35.6)]).state;
    const second = checkinReducer(afterFirst, temperatureRead(35.6));

    expect(second.state.step).toBe('evaluating');
    expect(second.effects).toEqual([{ type: 'evaluate' }]);
    expect(remeasuredOf(second.state)).toEqual(['body_temperature']);
    // The latest reading is the one kept for evaluation.
    expect(temperatureReads(second.state.confirmed)).toEqual([temperatureAt(35.6)]);
  });

  it('a second reading back in range (36,7 °C) replaces the first value and proceeds to evaluating', () => {
    const afterFirst = runFrom(atTemperatureStage, [temperatureRead(35.6)]).state;
    const second = checkinReducer(afterFirst, temperatureRead(36.7));

    expect(second.state.step).toBe('evaluating');
    expect(second.effects).toEqual([{ type: 'evaluate' }]);
    expect(temperatureReads(second.state.confirmed)).toEqual([temperatureAt(36.7)]);
  });

  it('a first temperature out of doubt (36,7 °C) causes no extra read', () => {
    const result = runFrom(atTemperatureStage, [temperatureRead(36.7)]);

    expect(result.state.step).toBe('evaluating');
    expect(result.effects).toEqual([{ type: 'evaluate' }]);
  });

  it('the extra read happens at most once, even if the temperature stays in doubt', () => {
    const { effects, state } = runFrom(atTemperatureStage, [
      temperatureRead(35.6),
      temperatureRead(35.6),
      temperatureRead(35.6),
    ]);

    expect(effects.filter((e) => e.type === 'readDevices')).toHaveLength(1);
    expect(state.step).toBe('evaluating');
  });

  it('the band lower edge (35,0 °C, TEMP_IN_DOUBT_BAND.min) is re-read', () => {
    // RangeBand bounds are optional in the type; this band sets both.
    const result = runFrom(atTemperatureStage, [temperatureRead(TEMP_IN_DOUBT_BAND.min as number)]);

    expect(result.state.step).toBe('measuring');
    expect(result.effects).toContainEqual({ type: 'readDevices', indicators: ['body_temperature'] });
  });

  it('the band is half-open: 36,1 °C (TEMP_IN_DOUBT_BAND.max) is not re-read', () => {
    const result = runFrom(atTemperatureStage, [temperatureRead(TEMP_IN_DOUBT_BAND.max as number)]);

    expect(result.state.step).toBe('evaluating');
    expect(result.effects).toEqual([{ type: 'evaluate' }]);
  });
});

