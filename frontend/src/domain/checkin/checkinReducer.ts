/**
 * Daily check-in reducer (T048, confirmation and retries T059). Pure: `(state, event) => { state, effects }`.
 *
 * The script enters as a parameter; this module never imports `config/`. Effects are
 * executed in order by the application runner, which feeds results back as events
 * (`spoken`, `transcript`, `buttonAnswer`, `devicesRead`, `evaluated`, `saved`).
 *
 * A value heard at an `ask` step stays `pending` until the following `confirm` step hears
 * "sí" (RF4). Only `confirmedVoice` may be saved (principle IX). The verdict rules (US5)
 * are injected into the runner that handles the `evaluate` effect.
 */
import { SENSOR_INDICATORS, SLEEP_HOURS_MAX } from '@base-vital/contracts';
import type { Indicator, Observation, SensorKey, Symptom, Verdict } from '@base-vital/contracts';
import { TEMP_IN_DOUBT_BAND } from '@base-vital/health-rules';
import { MOOD_MAX, MOOD_MIN, parseUtterance } from '../parsing/parseUtterance';
import type { Intent, ParseResult } from '../parsing/parseUtterance';
import type {
  CheckinEvent,
  CheckinScript,
  CheckinStep,
  Effect,
  StepId,
  StepKind,
} from './types';
import { needsMoodReask, settleMoodReask } from './moodReask';

/** A voice value as parsed: pending until confirmed, then part of `confirmedVoice`. */
export interface VoiceValue {
  indicator: 'sleep_hours' | 'mood';
  value: number;
}

/** Verdict and action key returned by the injected evaluation (`evaluated` event). */
export interface CheckinOutcome {
  verdict: Verdict;
  /** Key into `messages.es.ts`, spoken as given. */
  actionKey: string;
}

export interface CheckinState {
  step: StepId | 'idle' | 'evaluating' | 'saved';
  paused: boolean;
  script: CheckinScript;
  /** Index into `DEVICE_SEQUENCE` of the device being read during `measuring`. */
  deviceIndex: number;
  /** Parsed value waiting for its confirm step; `null` otherwise. */
  pending: VoiceValue | null;
  /** Values the user confirmed with "sí". Only these may be saved (RF4, principle IX). */
  confirmedVoice: VoiceValue[];
  /** Null transcripts per step. A step's count resets when the step gets an answer (RF12). */
  failures: Partial<Record<StepId, number>>;
  /** Device observations, confirmed on arrival. */
  confirmed: Observation[];
  /**
   * Indicators whose extra read was requested because the first value was in doubt (RN1).
   * Set when the second read is requested; a second read replaces the first observation.
   */
  remeasured: Indicator[];
  symptoms: Symptom[];
  outcome: CheckinOutcome | null;
  /** Summary lines still to be spoken; the summary step advances after the last one. */
  pendingSpeech: number;
  /** The pulse read said it is outside "tu normal" (CL4). Set by the pulse read, read when measuring ends. */
  pulseOutsideNormal: boolean;
  /** The mood was asked once more (CL4). The re-ask happens at most once per check-in. */
  moodReasked: boolean;
  /** Indicators whose value is in doubt; 'mood' when the re-asked mood equals the first one (CL4). */
  inDoubt: Indicator[];
}

export interface CheckinTransition {
  state: CheckinState;
  effects: Effect[];
}

/** Fixed device order of the measuring step: pressure → pulse → oxygen → temperature. */
const DEVICE_SEQUENCE: readonly SensorKey[] = ['pressure', 'pulse', 'oxygen', 'temperature'];

/** Null transcripts at one step before the big buttons replace listening. */
const FAILURES_BEFORE_BUTTONS = 2;

/** Retry prompt for a value outside its RN4 range. */
const RETRY_KEYS: Record<VoiceValue['indicator'], string> = {
  sleep_hours: 'retry.sleep',
  mood: 'retry.mood',
};

export function createCheckinState(input: { script: CheckinScript }): CheckinState {
  return {
    step: 'idle',
    paused: false,
    script: input.script,
    deviceIndex: 0,
    pending: null,
    confirmedVoice: [],
    failures: {},
    confirmed: [],
    remeasured: [],
    symptoms: [],
    outcome: null,
    pendingSpeech: 0,
    pulseOutsideNormal: false,
    moodReasked: false,
    inDoubt: [],
  };
}

export function checkinReducer(state: CheckinState, event: CheckinEvent): CheckinTransition {
  switch (event.type) {
    case 'start':
      return start(state);
    case 'spoken':
      return spoken(state);
    case 'transcript':
    case 'buttonAnswer':
      return transcript(state, event.text);
    case 'devicesRead':
      return devicesRead(state, event);
    case 'evaluated':
      return evaluated(state, event.result);
    case 'saved':
      return saved(state);
    case 'pause':
      return pause(state);
    case 'resume':
      return resume(state);
    case 'repeat':
      return repeat(state);
  }
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

function stepIndex(state: CheckinState): number {
  return state.script.findIndex((step) => step.id === state.step);
}

function currentStep(state: CheckinState): CheckinStep | undefined {
  const index = stepIndex(state);
  return index === -1 ? undefined : state.script[index];
}

/** The current step when it listens for an answer (`ask`, `confirm` or `next`), otherwise undefined. */
function listeningStep(state: CheckinState): CheckinStep | undefined {
  const step = currentStep(state);
  const listens = step !== undefined && (step.kind === 'ask' || step.kind === 'confirm' || step.kind === 'next');
  return listens ? step : undefined;
}

function grammarOf(step: CheckinStep): readonly string[] {
  return step.grammar ?? [];
}

/** Parser reading for a step. The closing "next activity" question is a yes/no answer. */
function parseKindOf(step: CheckinStep): StepKind {
  if (step.parse !== undefined) {
    return step.parse;
  }
  return step.kind === 'next' ? 'confirm' : 'none';
}

/** Read-back parameters of a confirm step: the pending value, named as its prompt uses it. */
function promptParams(state: CheckinState, step: CheckinStep): Record<string, number> | undefined {
  const { pending } = state;
  if (step.kind !== 'confirm' || pending === null) {
    return undefined;
  }
  return pending.indicator === 'sleep_hours' ? { hours: pending.value } : { mood: pending.value };
}

/** RN1: whether a temperature falls in TEMP_IN_DOUBT_BAND (half-open; a missing bound is open). */
function inTempDoubtBand(celsius: number): boolean {
  const { min, max } = TEMP_IN_DOUBT_BAND;
  return (min === undefined || celsius >= min) && (max === undefined || celsius < max);
}

/** RN4 range check: sleep up to SLEEP_HOURS_MAX (the parser never reads negative hours); mood an integer 1–5. */
function inRange(value: VoiceValue): boolean {
  if (value.indicator === 'sleep_hours') {
    return value.value <= SLEEP_HOURS_MAX;
  }
  return Number.isInteger(value.value) && value.value >= MOOD_MIN && value.value <= MOOD_MAX;
}

// ---------------------------------------------------------------------------
// Effect builders
// ---------------------------------------------------------------------------

function speak(key: string, params?: Record<string, number>): Effect {
  return params === undefined ? { type: 'speak', key } : { type: 'speak', key, params };
}

function listen(grammar: readonly string[]): Effect {
  return { type: 'listen', grammar };
}

function setFocus(sensor: SensorKey | null): Effect {
  return { type: 'setFocus', sensor };
}

/** Focus and device read for one stage of `measuring`. */
function readStage(deviceIndex: number): Effect[] {
  const sensor = DEVICE_SEQUENCE[deviceIndex];
  return [
    setFocus(sensor),
    { type: 'readDevices', indicators: SENSOR_INDICATORS[sensor] },
  ];
}

function unchanged(state: CheckinState): CheckinTransition {
  return { state, effects: [] };
}

// ---------------------------------------------------------------------------
// Step entry
// ---------------------------------------------------------------------------

/** Moves to the script step at `index` and emits its effects; no-op past the end of the script. */
function enterAt(state: CheckinState, index: number): CheckinTransition {
  const step = state.script[index];
  if (step === undefined) {
    return unchanged(state);
  }
  return enter({ ...state, step: step.id }, step);
}

function enter(state: CheckinState, step: CheckinStep): CheckinTransition {
  switch (step.kind) {
    case 'say':
      return { state, effects: [speak(step.messageKey)] };
    case 'ask':
    case 'confirm':
    case 'next':
      return prompt(state, step);
    case 'measure':
      return { state: { ...state, deviceIndex: 0 }, effects: [speak(step.messageKey), ...readStage(0)] };
    case 'summary':
      return summarise(state);
  }
}

/** Focus (when the step sets one), prompt, then listen. */
function prompt(state: CheckinState, step: CheckinStep): CheckinTransition {
  const focus = step.focus === undefined ? [] : [setFocus(step.focus)];
  return {
    state,
    effects: [...focus, speak(step.messageKey, promptParams(state, step)), listen(grammarOf(step))],
  };
}

/** Speaks the verdict headline and the one action from the evaluation result. */
function summarise(state: CheckinState): CheckinTransition {
  if (state.outcome === null) {
    return unchanged(state);
  }
  const keys = [`verdict.${state.outcome.verdict}`, state.outcome.actionKey].filter((k) => k !== '');
  return {
    state: { ...state, pendingSpeech: keys.length },
    effects: keys.map((key) => speak(key)),
  };
}

function advance(state: CheckinState): CheckinTransition {
  return enterAt(state, stepIndex(state) + 1);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function start(state: CheckinState): CheckinTransition {
  if (state.step !== 'idle') {
    return unchanged(state);
  }
  return enterAt(state, 0);
}

/**
 * A spoken line finished: `say` steps advance at once. A `summary` step advances after its
 * last line, so the action is heard before the next question.
 */
function spoken(state: CheckinState): CheckinTransition {
  const step = currentStep(state);
  if (step === undefined || (step.kind !== 'say' && step.kind !== 'summary')) {
    return unchanged(state);
  }
  if (step.kind === 'summary' && state.pendingSpeech > 1) {
    return { state: { ...state, pendingSpeech: state.pendingSpeech - 1 }, effects: [] };
  }
  return advance({ ...state, pendingSpeech: 0 });
}

/** A transcript, or a big-button answer (handled the same way). */
function transcript(state: CheckinState, text: string | null): CheckinTransition {
  const step = listeningStep(state);
  if (step === undefined) {
    return unchanged(state);
  }
  if (state.paused) {
    return pausedTranscript(state, step, text);
  }
  if (text === null) {
    return missed(state, step);
  }
  const parsed = parseUtterance(parseKindOf(step), text);
  if (parsed === null) {
    return missed(state, step);
  }
  return answer({ ...state, failures: { ...state.failures, [step.id]: 0 } }, step, parsed);
}

/** While paused the voice listens for control words only: "sigue" resumes, "repite" repeats. */
function pausedTranscript(
  state: CheckinState,
  step: CheckinStep,
  text: string | null,
): CheckinTransition {
  const parsed = text === null ? null : parseUtterance(parseKindOf(step), text);
  if (parsed?.kind === 'intent' && parsed.intent === 'resume') {
    return resume(state);
  }
  if (parsed?.kind === 'intent' && parsed.intent === 'repeat') {
    return repeat(state);
  }
  return relisten(state, step);
}

/** A null transcript is a failed listen. The second one at a step shows the buttons instead of listening. */
function missed(state: CheckinState, step: CheckinStep): CheckinTransition {
  const count = (state.failures[step.id] ?? 0) + 1;
  const next = { ...state, failures: { ...state.failures, [step.id]: count } };
  if (count < FAILURES_BEFORE_BUTTONS) {
    return relisten(next, step);
  }
  return { state: next, effects: [{ type: 'showButtons', step: step.id }] };
}

function answer(state: CheckinState, step: CheckinStep, parsed: ParseResult): CheckinTransition {
  switch (parsed.kind) {
    case 'value':
      return heardValue(state, step, { indicator: parsed.indicator, value: parsed.value });
    case 'symptoms':
      return advance({ ...state, symptoms: parsed.symptoms });
    case 'intent':
      return intent(state, step, parsed.intent);
  }
}

/** RN4: an out-of-range value speaks its retry and listens on the same step; otherwise it waits for confirmation. */
function heardValue(state: CheckinState, step: CheckinStep, value: VoiceValue): CheckinTransition {
  if (!inRange(value)) {
    return { state, effects: [speak(RETRY_KEYS[value.indicator]), listen(grammarOf(step))] };
  }
  return advance({ ...state, pending: value });
}

function intent(state: CheckinState, step: CheckinStep, name: Intent): CheckinTransition {
  switch (name) {
    case 'pause':
      return pause(state);
    case 'repeat':
      return repeat(state);
    case 'confirm':
      if (step.kind === 'next') {
        return { state, effects: [{ type: 'save' }] };
      }
      return step.kind === 'confirm' ? confirmPending(state, step) : relisten(state, step);
    case 'deny':
      return step.kind === 'confirm' ? backToAsk(state) : relisten(state, step);
    case 'resume':
      return relisten(state, step);
  }
}

/**
 * "sí" at a confirm step: the pending value is confirmed and the flow moves on (RF4). After the CL4
 * re-ask the mood settles instead, and the check goes to evaluation (no ask_symptoms again).
 */
function confirmPending(state: CheckinState, step: CheckinStep): CheckinTransition {
  const { pending } = state;
  if (pending === null) {
    return relisten(state, step);
  }
  if (state.moodReasked && step.id === 'confirm_mood') {
    const settled = settleMoodReask(state.confirmedVoice, pending);
    const inDoubt = settled.inDoubt ? [...state.inDoubt, 'mood' as const] : state.inDoubt;
    return toEvaluation({ ...state, pending: null, confirmedVoice: settled.confirmedVoice, inDoubt });
  }
  return advance({ ...state, pending: null, confirmedVoice: [...state.confirmedVoice, pending] });
}

/**
 * "no" at a confirm step: the pending value is dropped and the ask step before it runs again. After
 * the CL4 re-ask, "no" asks the mood again with the same gentle words; that is not a second re-ask.
 */
function backToAsk(state: CheckinState): CheckinTransition {
  const cleared = { ...state, pending: null };
  if (state.moodReasked && state.step === 'confirm_mood') {
    return reaskMood(cleared);
  }
  return enterAt(cleared, stepIndex(state) - 1);
}

/** The pulse was outside normal and the mood is ≥ 4: the mood is asked once more (CL4, D33). */
function reaskMood(state: CheckinState): CheckinTransition {
  const step = state.script.find((candidate) => candidate.id === 'ask_mood');
  if (step === undefined) {
    return toEvaluation(state);
  }
  // CA3: the forehead (sleep) is highlighted while Vita asks about the mood, so the focus comes first.
  const focus = step.focus === undefined ? [] : [setFocus(step.focus)];
  return {
    state: { ...state, step: 'ask_mood', moodReasked: true },
    effects: [...focus, speak('ask.mood.again'), listen(grammarOf(step))],
  };
}

/** Evaluation is next: the reducer's `evaluate` effect runs the verdict rules with the state. */
function toEvaluation(state: CheckinState): CheckinTransition {
  return { state: { ...state, step: 'evaluating' }, effects: [{ type: 'evaluate' }] };
}

function relisten(state: CheckinState, step: CheckinStep): CheckinTransition {
  return { state, effects: [listen(grammarOf(step))] };
}

/**
 * A temperature in TEMP_IN_DOUBT_BAND at its first read asks for one extra thermometer read
 * (RN1). The extra read happens at most once: `remeasured` is set by then.
 */
function needsTemperatureReread(state: CheckinState, observations: Observation[]): boolean {
  return (
    DEVICE_SEQUENCE[state.deviceIndex] === 'temperature' &&
    !state.remeasured.includes('body_temperature') &&
    observations.some((o) => o.indicator === 'body_temperature' && inTempDoubtBand(o.value))
  );
}

function devicesRead(
  state: CheckinState,
  event: Extract<CheckinEvent, { type: 'devicesRead' }>,
): CheckinTransition {
  const step = currentStep(state);
  if (step === undefined || step.kind !== 'measure') {
    return unchanged(state);
  }
  const { observations } = event;
  // Only the pulse read carries the flag; the other reads keep the value the pulse read set.
  const withPulse = { ...state, pulseOutsideNormal: event.pulseOutsideNormal ?? state.pulseOutsideNormal };
  if (needsTemperatureReread(withPulse, observations)) {
    // The first value is kept until the second read replaces it; the stage does not advance.
    // Vita says why the thermometer is used again, so the chat shows the extra read.
    const reread = {
      ...withPulse,
      confirmed: [...withPulse.confirmed, ...observations],
      remeasured: [...withPulse.remeasured, 'body_temperature' as const],
    };
    return { state: reread, effects: [speak('measure.temperature.again'), ...readStage(withPulse.deviceIndex)] };
  }
  // The second read of a re-measured temperature replaces the first observation.
  const replacing = withPulse.remeasured.includes('body_temperature');
  const kept = replacing
    ? withPulse.confirmed.filter((o) => o.indicator !== 'body_temperature')
    : withPulse.confirmed;
  const deviceIndex = withPulse.deviceIndex + 1;
  const next = { ...withPulse, confirmed: [...kept, ...observations], deviceIndex };
  if (deviceIndex < DEVICE_SEQUENCE.length) {
    return { state: next, effects: readStage(deviceIndex) };
  }
  // Measuring is done: the CL4 mood re-ask comes first when it applies, otherwise evaluation.
  if (needsMoodReask(next)) {
    return reaskMood(next);
  }
  return toEvaluation(next);
}

function evaluated(state: CheckinState, result: CheckinOutcome): CheckinTransition {
  if (state.step !== 'evaluating') {
    return unchanged(state);
  }
  const summaryIndex = state.script.findIndex((step) => step.kind === 'summary');
  if (summaryIndex === -1) {
    return unchanged(state);
  }
  return enterAt({ ...state, outcome: result }, summaryIndex);
}

function saved(state: CheckinState): CheckinTransition {
  const step = currentStep(state);
  if (step === undefined || step.kind !== 'next') {
    return unchanged(state);
  }
  return { state: { ...state, step: 'saved' }, effects: [] };
}

/** Pauses the check-in. The voice keeps listening, for control words only (see `pausedTranscript`). */
function pause(state: CheckinState): CheckinTransition {
  const step = listeningStep(state);
  if (step === undefined || state.paused) {
    return unchanged(state);
  }
  return { state: { ...state, paused: true }, effects: [listen(grammarOf(step))] };
}

function resume(state: CheckinState): CheckinTransition {
  const step = listeningStep(state);
  if (step === undefined || !state.paused) {
    return unchanged(state);
  }
  return { state: { ...state, paused: false }, effects: [listen(grammarOf(step))] };
}

/** Re-speaks the current prompt, then listens again (also while paused). */
function repeat(state: CheckinState): CheckinTransition {
  const step = listeningStep(state);
  if (step === undefined) {
    return unchanged(state);
  }
  return { state, effects: [speak(step.messageKey, promptParams(state, step)), listen(grammarOf(step))] };
}
