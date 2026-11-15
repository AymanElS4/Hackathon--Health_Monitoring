/**
 * Confirmation and retry tests for the daily check-in reducer (T058, US2, RF4 / RN4 / CL1 / RF12).
 * Written before T059; must FAIL until T059 is implemented.
 *
 * API additions T059 must make (on top of the T048 API used by reducer.flow.test.ts):
 *
 *   // frontend/src/domain/checkin/types.ts
 *   export type StepId =
 *     | 'greeting' | 'ask_sleep' | 'confirm_sleep' | 'ask_mood' | 'confirm_mood'
 *     | 'ask_symptoms' | 'measuring' | 'summary' | 'next_activity';
 *   export interface CheckinStep {
 *     kind: 'say' | 'ask' | 'confirm' | 'measure' | 'summary' | 'next';   // 'confirm' is new
 *     // ...other fields unchanged
 *   }
 *   export type CheckinEvent =
 *     | ...existing events...
 *     | { type: 'buttonAnswer'; text: string };   // a big-button answer, handled like a transcript
 *
 *   // frontend/src/domain/checkin/checkinReducer.ts
 *   export interface CheckinState {
 *     // ...existing fields...
 *     pending: VoiceValue | null;            // parsed value waiting for its confirm step; null otherwise
 *     confirmedVoice: VoiceValue[];          // values the user confirmed with "sí" (only these may be saved, RF4)
 *     failures: Partial<Record<StepId, number>>; // null transcripts per step; reset when the step gets an answer
 *   }
 *   // A null transcript counts as a failure. RN4 range retries ("retry.*") do not count.
 *   // The second consecutive failure at a step emits { type: 'showButtons', step } and no
 *   // `listen` effect: the voice stops and waits for a `buttonAnswer` event.
 *
 *   // frontend/src/domain/checkin/checkinReducer.ts or frontend/src/domain/parsing/parseUtterance.ts
 *   // Bounds come from the source of truth; no magic numbers in the reducer:
 *   //   SLEEP_HOURS_MAX (16) exported from @base-vital/contracts (today a private const in entities.ts)
 *   //   MOOD_MIN / MOOD_MAX (1 / 5) exported from parseUtterance.ts (already exported)
 *
 * Sleep range check (RN4): a value above SLEEP_HOURS_MAX or a mood outside MOOD_MIN..MOOD_MAX
 * speaks `retry.sleep` / `retry.mood` and listens again on the same step. Nothing is stored.
 */
import { describe, it, expect } from 'vitest';
import { SLEEP_HOURS_MAX } from '@base-vital/contracts';
import { MOOD_MAX, MOOD_MIN } from '../../../src/domain/parsing/parseUtterance';
import type { CheckinEvent, CheckinScript, Effect } from '../../../src/domain/checkin/types';
import type { CheckinState } from '../../../src/domain/checkin/checkinReducer';
import {
  checkinReducer,
  createCheckinState,
} from '../../../src/domain/checkin/checkinReducer';

// ---------------------------------------------------------------------------
// Script fixture: the daily script with confirm steps (contracts/checkin-script.md)
// ---------------------------------------------------------------------------

const CONTROL = ['para', 'sigue', 'repite'];
/** Upper bound of the spoken-number grammar at ask_sleep (contract: numbers 0–24). Above SLEEP_HOURS_MAX is RN4. */
const SPOKEN_SLEEP_GRAMMAR_MAX = 24;
const sleepGrammar = [
  ...Array.from({ length: SPOKEN_SLEEP_GRAMMAR_MAX + 1 }, (_, i) => String(i)),
  'y media',
  ...CONTROL,
  '[unk]',
];
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
// Event helpers
// ---------------------------------------------------------------------------

const tx = (text: string | null): CheckinEvent => ({ type: 'transcript', text });
const button = (text: string): CheckinEvent => ({ type: 'buttonAnswer', text });

/**
 * Runs events from a fresh state built with the fixture script. `effects` are those of the
 * last event only, so prefix prompts (greeting, ask_sleep) do not leak into the assertions.
 * `allEffects` concatenates the effects of every event, so a `save` earlier in the run is caught.
 */
function run(events: readonly CheckinEvent[]) {
  let state: CheckinState = createCheckinState({ script });
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

/** Runs one more event from an existing state. */
function step(state: CheckinState, event: CheckinEvent) {
  return checkinReducer(state, event);
}

function hasEffect(effects: readonly Effect[], type: Effect['type']): boolean {
  return effects.some((effect) => effect.type === type);
}

// Event prefixes that reach each point of the flow.
const TO_ASK_SLEEP: CheckinEvent[] = [{ type: 'start' }, { type: 'spoken' }];
const TO_CONFIRM_SLEEP: CheckinEvent[] = [...TO_ASK_SLEEP, tx('cinco horas')];
const TO_ASK_MOOD: CheckinEvent[] = [...TO_CONFIRM_SLEEP, tx('sí')];
const TO_CONFIRM_MOOD: CheckinEvent[] = [...TO_ASK_MOOD, tx('cuatro')];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bounds come from contracts and the parser', () => {
  it('SLEEP_HOURS_MAX is 16 and exported from @base-vital/contracts', () => {
    expect(SLEEP_HOURS_MAX).toBe(16);
  });

  it('mood bounds are the 1–5 scale', () => {
    expect([MOOD_MIN, MOOD_MAX]).toEqual([1, 5]);
  });
});

describe('sleep confirmation (RF4)', () => {
  it('"cinco horas" at ask_sleep moves to confirm_sleep and reads the value back', () => {
    const { state, effects } = run([...TO_ASK_SLEEP, tx('cinco horas')]);

    expect(state.step).toBe('confirm_sleep');
    expect(effects).toContainEqual({ type: 'speak', key: 'confirm.sleep', params: { hours: 5 } });
    expect(effects).toContainEqual({ type: 'listen', grammar: confirmGrammar });
  });

  it('"cinco horas" is only pending: nothing is saved and nothing is confirmed yet', () => {
    const { state, effects, allEffects } = run([...TO_ASK_SLEEP, tx('cinco horas')]);

    expect(hasEffect(effects, 'save')).toBe(false);
    expect(hasEffect(allEffects, 'save')).toBe(false);
    expect(state.confirmedVoice).toEqual([]);
    expect(state.pending).toEqual({ indicator: 'sleep_hours', value: 5 });
  });

  it('"sí" at confirm_sleep marks the sleep value confirmed and moves to ask_mood', () => {
    const { state, effects, allEffects } = run([...TO_CONFIRM_SLEEP, tx('sí')]);

    expect(state.step).toBe('ask_mood');
    expect(state.confirmedVoice).toEqual([{ indicator: 'sleep_hours', value: 5 }]);
    expect(state.pending).toBeNull();
    expect(hasEffect(effects, 'save')).toBe(false);
    expect(hasEffect(allEffects, 'save')).toBe(false);
  });

  it('"no" at confirm_sleep goes back to ask_sleep and confirms nothing', () => {
    const { state, effects, allEffects } = run([...TO_CONFIRM_SLEEP, tx('no')]);

    expect(state.step).toBe('ask_sleep');
    expect(state.confirmedVoice).toEqual([]);
    expect(state.pending).toBeNull();
    expect(effects).toContainEqual({ type: 'speak', key: 'ask.sleep' });
    expect(effects).toContainEqual({ type: 'listen', grammar: sleepGrammar });
    expect(hasEffect(effects, 'save')).toBe(false);
    expect(hasEffect(allEffects, 'save')).toBe(false);
  });

  it('"dormí 20 horas" at ask_sleep reads the number, speaks retry.sleep and listens on the same step', () => {
    const { state, effects } = run([...TO_ASK_SLEEP, tx('dormí 20 horas')]);

    expect(state.step).toBe('ask_sleep');
    expect(effects).toEqual([
      { type: 'speak', key: 'retry.sleep' },
      { type: 'listen', grammar: sleepGrammar },
    ]);
  });

  it('"veinte horas" at ask_sleep (above SLEEP_HOURS_MAX) speaks retry.sleep and listens on the same step', () => {
    const { state, effects, allEffects } = run([...TO_ASK_SLEEP, tx('veinte horas')]);

    expect(state.step).toBe('ask_sleep');
    expect(effects).toEqual([
      { type: 'speak', key: 'retry.sleep' },
      { type: 'listen', grammar: sleepGrammar },
    ]);
    expect(state.pending).toBeNull();
    expect(state.confirmedVoice).toEqual([]);
    expect(hasEffect(effects, 'save')).toBe(false);
    expect(hasEffect(allEffects, 'save')).toBe(false);
  });
});

describe('mood confirmation and range (RN4)', () => {
  it('"cuatro" at ask_mood moves to confirm_mood and reads the mood back', () => {
    const { state, effects } = run(TO_CONFIRM_MOOD);

    expect(state.step).toBe('confirm_mood');
    expect(effects).toContainEqual({ type: 'speak', key: 'confirm.mood', params: { mood: 4 } });
    expect(state.pending).toEqual({ indicator: 'mood', value: 4 });
    expect(state.confirmedVoice).toEqual([{ indicator: 'sleep_hours', value: 5 }]);
  });

  it('"sí" at confirm_mood confirms the mood and moves to ask_symptoms', () => {
    const { state, effects, allEffects } = run([...TO_CONFIRM_MOOD, tx('sí')]);

    expect(state.step).toBe('ask_symptoms');
    expect(state.confirmedVoice).toContainEqual({ indicator: 'mood', value: 4 });
    expect(hasEffect(effects, 'save')).toBe(false);
    expect(hasEffect(allEffects, 'save')).toBe(false);
  });

  it.each([
    { word: 'cero', value: MOOD_MIN - 1 },
    { word: 'seis', value: MOOD_MAX + 1 },
  ])('mood "$word" ($value, outside 1–5) at ask_mood speaks retry.mood and stays on ask_mood', ({ word }) => {
    const { state, effects, allEffects } = run([...TO_ASK_MOOD, tx(word)]);

    expect(state.step).toBe('ask_mood');
    expect(effects).toEqual([
      { type: 'speak', key: 'retry.mood' },
      { type: 'listen', grammar: moodGrammar },
    ]);
    expect(state.pending).toBeNull();
    expect(state.confirmedVoice).toEqual([{ indicator: 'sleep_hours', value: 5 }]);
    expect(hasEffect(effects, 'save')).toBe(false);
    expect(hasEffect(allEffects, 'save')).toBe(false);
  });
});

describe('failed recognitions (CL1, RF12)', () => {
  it('one null transcript re-listens on the same step and counts one failure', () => {
    const { state, effects } = run([...TO_ASK_SLEEP, tx(null)]);

    expect(state.step).toBe('ask_sleep');
    expect(state.failures.ask_sleep).toBe(1);
    expect(effects).toEqual([{ type: 'listen', grammar: sleepGrammar }]);
  });

  it('two null transcripts in a row at one step show the big buttons for that step and stop listening', () => {
    const { state, effects } = run([...TO_ASK_SLEEP, tx(null), tx(null)]);

    expect(state.step).toBe('ask_sleep');
    expect(state.failures.ask_sleep).toBe(2);
    expect(effects).toContainEqual({ type: 'showButtons', step: 'ask_sleep' });
    expect(hasEffect(effects, 'listen')).toBe(false);
  });

  it('a button answer continues the flow exactly like a transcript', () => {
    const shown = run([...TO_ASK_SLEEP, tx(null), tx(null)]).state;

    const answered = step(shown, button('siete'));

    expect(answered.state.step).toBe('confirm_sleep');
    expect(answered.effects).toContainEqual({
      type: 'speak',
      key: 'confirm.sleep',
      params: { hours: 7 },
    });
    expect(answered.state.pending).toEqual({ indicator: 'sleep_hours', value: 7 });
  });

  it('two unrecognised transcripts in a row at one step show the big buttons', () => {
    const { state, effects } = run([...TO_ASK_SLEEP, tx('banana'), tx('banana')]);

    expect(state.step).toBe('ask_sleep');
    expect(state.failures.ask_sleep).toBe(2);
    expect(effects).toContainEqual({ type: 'showButtons', step: 'ask_sleep' });
    expect(hasEffect(effects, 'listen')).toBe(false);
  });

  it('an answer resets the failure count, so a later single null does not show buttons', () => {
    const { state, effects } = run([
      ...TO_ASK_SLEEP,
      tx(null),
      tx('siete'),
      tx('no'),
      tx(null),
    ]);

    expect(state.step).toBe('ask_sleep');
    expect(state.failures.ask_sleep).toBe(1);
    expect(hasEffect(effects, 'showButtons')).toBe(false);
  });
});
