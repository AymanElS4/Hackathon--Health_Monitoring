/**
 * CL4 mood re-ask tests for the daily check-in reducer (T082, spec CL4 and R10).
 * Written before T086; must FAIL until T086 is implemented.
 *
 * Rule (spec CL4): mood ≥ 4 while the pulse is outside "tu normal" → Vita asks the mood once more.
 * Pulse within "tu normal" (or mood below 4) → no re-ask.
 *
 * DECISION (coordinator, Principle IX): every voice-captured number is read back and confirmed
 * before it is stored or used. So the re-ask answer is NOT used directly. It goes through the
 * normal `confirm_mood` step ("Escuché que tu ánimo es N de 5. ¿Es correcto?"):
 *   - Re-ask: speak `ask.mood.again`, listen with the ask_mood grammar. The answer is pending.
 *   - Confirmed with the SAME value as the first confirmed mood → mood added to `inDoubt`
 *     (attention via the evaluation).
 *   - Confirmed with a DIFFERENT value → it replaces the mood in `confirmedVoice` (the old mood
 *     entry is removed); nothing is in doubt.
 *   - "no" at the confirmation → the pending value is dropped and `ask.mood.again` is spoken
 *     again. This repeat is not a second re-ask: the CL4 re-ask is still the one request.
 *   - Null transcripts during the re-ask follow the usual CL1/RF12 rules: the first re-listens on
 *     the same ask step, the second shows the big buttons for the ask step (`showButtons` with
 *     step `ask_mood`). A button answer is handled like a transcript.
 *   The comparison is always with the mood confirmed before the re-ask (the first answer).
 *
 * Hook chosen for T086 (least invasive, consistent with the reducer's pure design):
 *
 *   // frontend/src/domain/checkin/types.ts
 *   | { type: 'devicesRead'; observations: Observation[]; pulseOutsideNormal?: boolean }
 *
 *   The runner computes `pulseOutsideNormal` with `isOutsideNormal` (T085) for the pulse read and
 *   sends it on that event. The field is optional, so existing flow tests are unchanged. The reducer
 *   keeps it in state and reads it once, when the measuring step ends (before the `evaluate` effect).
 *   The `evaluate` effect keeps its shape `{ type: 'evaluate' }`.
 *
 *   // frontend/src/domain/checkin/checkinReducer.ts (state fields added by T086)
 *   pulseOutsideNormal: boolean;   // initial false, set by the pulse read
 *   moodReasked: boolean;          // initial false, set when the CL4 re-ask is requested
 *   inDoubt: Indicator[];          // initial []; 'mood' is added on a same-value confirmation
 *
 *   The re-ask is the ask_mood step entered again (so failure counting and buttons use
 *   `ask_mood`). The confirmation uses `confirm_mood`. Internal step handling is T086's choice;
 *   these tests check effects, the confirmation flow and the state fields above.
 *
 * CA3 (focus): the forehead (sleep) is highlighted while Vita asks about sleep or mood. So the
 *   re-ask emits `setFocus('sleep')` before its speak and listen, and the focus stays on sleep
 *   through the re-ask's `confirm_mood` (the confirm step sets the same focus).
 */
import { describe, it, expect } from 'vitest';
import type { Indicator, Observation } from '@base-vital/contracts';
import type { CheckinEvent, CheckinScript, Effect } from '../../../src/domain/checkin/types';
import type { CheckinState } from '../../../src/domain/checkin/checkinReducer';
import {
  checkinReducer,
  createCheckinState,
} from '../../../src/domain/checkin/checkinReducer';

// ---------------------------------------------------------------------------
// Script fixture (contracts/checkin-script.md, same as reducer.confirm.test.ts)
// ---------------------------------------------------------------------------

const CONTROL = ['para', 'sigue', 'repite'];
const sleepGrammar = [...Array.from({ length: 25 }, (_, i) => String(i)), 'y media', ...CONTROL, '[unk]'];
const moodGrammar = ['1', '2', '3', '4', '5', 'mal', 'bien', 'muy bien', ...CONTROL, '[unk]'];
const confirmGrammar = ['sí', 'no', ...CONTROL, '[unk]'];
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
    id: 'confirm_sleep',
    kind: 'confirm',
    messageKey: 'confirm.sleep',
    parse: 'confirm',
    grammar: { es: confirmGrammar, en: confirmGrammar },
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
    id: 'confirm_mood',
    kind: 'confirm',
    messageKey: 'confirm.mood',
    parse: 'confirm',
    grammar: { es: confirmGrammar, en: confirmGrammar },
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
const button = (text: string): CheckinEvent => ({ type: 'buttonAnswer', text });

const pressure: Observation = {
  indicator: 'blood_pressure',
  value: { systolic: 118, diastolic: 76 },
  source: 'device',
  confirmed: true,
  simulated: true,
  at,
};
const pulse: Observation = {
  indicator: 'resting_heart_rate',
  value: 72,
  source: 'device',
  confirmed: true,
  simulated: true,
  at,
};
const oxygen: Observation = {
  indicator: 'oxygen_saturation',
  value: 97,
  source: 'device',
  confirmed: true,
  simulated: true,
  at,
};
const temperature: Observation = {
  indicator: 'body_temperature',
  value: 36.7,
  source: 'device',
  confirmed: true,
  simulated: true,
  at,
};

/**
 * A devicesRead event. `pulseOutsideNormal` is the T086 hook (see header); it is written with an
 * assertion because the field does not exist on CheckinEvent until T086.
 */
const read = (observation: Observation, pulseOutsideNormal?: boolean): CheckinEvent =>
  ({
    type: 'devicesRead',
    observations: [observation],
    ...(pulseOutsideNormal === undefined ? {} : { pulseOutsideNormal }),
  }) as CheckinEvent;

/** Pressure, pulse (with its outside-normal flag) and oxygen, before the temperature read. */
const readsBeforeTemperature = (pulseOutsideNormal: boolean): CheckinEvent[] => [
  read(pressure),
  read(pulse, pulseOutsideNormal),
  read(oxygen),
];

/** Sleep 5 h confirmed, then the mood answered and confirmed, then no symptoms: measuring is next. */
const toMeasuring = (moodWord: string): CheckinEvent[] => [
  { type: 'start' },
  { type: 'spoken' },
  tx('cinco horas'),
  tx('sí'),
  tx(moodWord),
  tx('sí'),
  tx('ninguno'),
];

/** Measuring finished with the pulse outside normal (or not): the CL4 decision point. */
const measuredWith = (moodWord: string, pulseOutsideNormal: boolean): CheckinEvent[] => [
  ...toMeasuring(moodWord),
  ...readsBeforeTemperature(pulseOutsideNormal),
  read(temperature),
];

/** Runs events from a fresh state built with the fixture script. */
function run(events: readonly CheckinEvent[]) {
  return runFrom(createCheckinState({ script }), events);
}

/**
 * Runs events from an existing state. `effects` are those of the last event only;
 * `allEffects` concatenates the effects of every event.
 */
function runFrom(initial: CheckinState, events: readonly CheckinEvent[]) {
  let state = initial;
  let effects: Effect[] = [];
  const allEffects: Effect[] = [];
  for (const event of events) {
    const result = checkinReducer(state, event);
    state = result.state;
    effects = result.effects;
    allEffects.push(...result.effects);
  }
  return { state, effects, allEffects };
}

/** `inDoubt` and `pending` are T086 / existing state fields; read defensively until T086 exists. */
const inDoubtOf = (state: CheckinState): Indicator[] =>
  (state as CheckinState & { inDoubt?: Indicator[] }).inDoubt ?? [];

const ASK_AGAIN_SPEECH: Effect = { type: 'speak', key: 'ask.mood.again' };
const EVALUATE: Effect = { type: 'evaluate' };
const LISTEN_MOOD: Effect = { type: 'listen', grammar: moodGrammar };
const LISTEN_CONFIRM: Effect = { type: 'listen', grammar: confirmGrammar };
const confirmMoodSpeech = (mood: number): Effect => ({ type: 'speak', key: 'confirm.mood', params: { mood } });
const SET_FOCUS_SLEEP: Effect = { type: 'setFocus', sensor: 'sleep' };

const countSpeech = (effects: readonly Effect[], key: string) =>
  effects.filter((effect) => effect.type === 'speak' && effect.key === key).length;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CL4: mood asked once more when the pulse is outside "tu normal"', () => {
  it.each([['cuatro', 4], ['cinco', 5]])(
    'mood "%s" (%i) confirmed, pulse outside normal: after measuring Vita asks the mood once more',
    (word) => {
      const { state, effects } = run(measuredWith(word, true));

      expect(effects).toContainEqual(ASK_AGAIN_SPEECH);
      expect(effects).toContainEqual(LISTEN_MOOD);
      expect(effects).not.toContainEqual(EVALUATE);
      expect(state.step).not.toBe('evaluating');
    },
  );

  it('the re-ask speaks the gentle key ask.mood.again and listens with the mood grammar', () => {
    const { effects } = run(measuredWith('cuatro', true));

    expect(effects).toEqual([SET_FOCUS_SLEEP, ASK_AGAIN_SPEECH, LISTEN_MOOD]);
  });

  it('the re-ask answer goes to confirmation (confirm_mood), not straight to evaluation', () => {
    const asked = run(measuredWith('cuatro', true)).state;

    const answered = runFrom(asked, [tx('cuatro')]);

    expect(answered.effects).toEqual([SET_FOCUS_SLEEP, confirmMoodSpeech(4), LISTEN_CONFIRM]);
    expect(answered.effects).not.toContainEqual(EVALUATE);
    expect(answered.state.pending).toEqual({ indicator: 'mood', value: 4 });
  });

  it('confirmed with the same value: the mood observation is marked in_doubt and evaluation runs', () => {
    const asked = run(measuredWith('cuatro', true)).state;

    const confirmed = runFrom(asked, [tx('cuatro'), tx('sí')]);

    expect(inDoubtOf(confirmed.state)).toContain('mood');
    expect(confirmed.effects).toEqual([EVALUATE]);
  });

  it('confirmed with a different value: the new mood replaces the old one and nothing is in_doubt', () => {
    const asked = run(measuredWith('cuatro', true)).state;

    const confirmed = runFrom(asked, [tx('tres'), tx('sí')]);

    expect(inDoubtOf(confirmed.state)).not.toContain('mood');
    expect(confirmed.state.confirmedVoice).toContainEqual({ indicator: 'mood', value: 3 });
    expect(confirmed.state.confirmedVoice).not.toContainEqual({ indicator: 'mood', value: 4 });
    expect(confirmed.effects).toEqual([EVALUATE]);
  });

  it('"no" at the confirmation asks again with ask.mood.again, and the next answer is confirmed as usual', () => {
    const asked = run(measuredWith('cuatro', true)).state;

    const denied = runFrom(asked, [tx('cuatro'), tx('no')]);

    expect(denied.effects).toEqual([SET_FOCUS_SLEEP, ASK_AGAIN_SPEECH, LISTEN_MOOD]);
    expect(denied.effects).not.toContainEqual(EVALUATE);
    expect(denied.state.pending).toBeNull();

    const reanswered = runFrom(denied.state, [tx('tres'), tx('sí')]);
    expect(reanswered.effects).toEqual([EVALUATE]);
    expect(reanswered.state.confirmedVoice).toContainEqual({ indicator: 'mood', value: 3 });
  });

  it('asked only once: the CL4 re-ask is requested once, and a confirmed answer goes straight to evaluation', () => {
    const { allEffects, effects } = run([...measuredWith('cuatro', true), tx('cuatro'), tx('sí')]);

    expect(countSpeech(allEffects, 'ask.mood.again')).toBe(1);
    expect(effects).toEqual([EVALUATE]);
  });

  it('a null transcript during the re-ask re-listens on the same ask step (CL1, first failure)', () => {
    const asked = run(measuredWith('cuatro', true)).state;

    const missed = runFrom(asked, [tx(null)]);

    expect(missed.effects).toEqual([LISTEN_MOOD]);
    expect(missed.effects).not.toContainEqual({ type: 'showButtons', step: 'ask_mood' });
    expect(missed.state.failures.ask_mood).toBe(1);
  });

  it('two null transcripts in a row during the re-ask show the big buttons for ask_mood (CL1, RF12)', () => {
    const asked = run(measuredWith('cuatro', true)).state;

    const shown = runFrom(asked, [tx(null), tx(null)]);

    expect(shown.effects).toContainEqual({ type: 'showButtons', step: 'ask_mood' });
    expect(shown.effects).not.toContainEqual(LISTEN_MOOD);
    expect(shown.state.failures.ask_mood).toBe(2);
  });

  it('a button answer during the re-ask is handled like a transcript and goes to confirmation', () => {
    const shown = runFrom(run(measuredWith('cuatro', true)).state, [tx(null), tx(null)]).state;

    const answered = runFrom(shown, [button('cuatro')]);

    expect(answered.effects).toEqual([SET_FOCUS_SLEEP, confirmMoodSpeech(4), LISTEN_CONFIRM]);
  });
});

describe('CL4: no re-ask when it does not apply', () => {
  it('pulse within "tu normal": no re-ask, the measuring step evaluates', () => {
    const { state, effects, allEffects } = run(measuredWith('cuatro', false));

    expect(state.step).toBe('evaluating');
    expect(effects).toEqual([EVALUATE]);
    expect(countSpeech(allEffects, 'ask.mood.again')).toBe(0);
    expect(inDoubtOf(state)).not.toContain('mood');
  });

  it('pulse outside normal but mood below 4 (3): no re-ask (CL4 applies to mood ≥ 4 only)', () => {
    const { state, effects, allEffects } = run(measuredWith('tres', true));

    expect(state.step).toBe('evaluating');
    expect(effects).toEqual([EVALUATE]);
    expect(countSpeech(allEffects, 'ask.mood.again')).toBe(0);
  });
});
