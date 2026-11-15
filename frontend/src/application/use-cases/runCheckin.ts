/**
 * Check-in runner (T052, buttons T059, save T093). Owns the reducer state, executes its effects in
 * order through the ports, and feeds the results back as events. The script is typed here against
 * the domain `CheckinScript`. The `save` effect persists the record before `saved` is dispatched.
 */
import type { SensorKey } from '@base-vital/contracts';
import { LISTEN_TIMEOUT_MS, SAVE_TIMEOUT_MS } from '../../config/constants';
import { t } from '../../config/messages.es';
import { checkinReducer, createCheckinState } from '../../domain/checkin/checkinReducer';
import type { CheckinState } from '../../domain/checkin/checkinReducer';
import type { CheckinEvent, CheckinScript, Effect, StepId } from '../../domain/checkin/types';
import type {
  AgendaPort,
  CheckRepositoryPort,
  ClockPort,
  DevicePort,
  SpeechRecognizerPort,
  SpeechSynthesizerPort,
} from '../ports';
import {
  evaluatedReadings,
  evaluationFacts,
  nextItemAt,
  type CheckinEvaluation,
  type EvaluationFacts,
} from './checkinEvaluation';
import { buildCheckRecord } from './buildCheckRecord';
import { withTimeout } from './withTimeout';
import { readDeviceObservations } from './readDeviceObservations';

export type { CheckinSnapshotOutcome, NextItem } from './checkinEvaluation';
export type { CheckinSnapshot, SpokenLine } from './checkinSnapshot';
import type { CheckinSnapshot, SpokenLine } from './checkinSnapshot';

export interface CheckinDeps {
  recognizer: SpeechRecognizerPort;
  synthesizer: SpeechSynthesizerPort;
  devices: DevicePort;
  agenda: AgendaPort;
  clock: ClockPort;
  /** Persists the finished check-in (T093). */
  repository: CheckRepositoryPort;
  /** Verdict rules (US5); receives the reducer state when measuring is done. */
  evaluate: (state: CheckinState) => Promise<CheckinEvaluation> | CheckinEvaluation;
  script: CheckinScript;
}

export interface CheckinRunner {
  start(): Promise<void>;
  dispatch(event: CheckinEvent): Promise<void>;
  getSnapshot(): CheckinSnapshot;
  subscribe(callback: () => void): () => void;
  /** Stops listening and speech; later dispatches and effects do nothing. Used on unmount. */
  dispose(): void;
}

export function createCheckinRunner(deps: CheckinDeps): CheckinRunner {
  let state = createCheckinState({ script: deps.script });
  let view = {
    focus: null as SensorKey | null,
    caption: null as string | null,
    listening: false,
    buttonsFor: null as StepId | null,
    saveFailed: false,
    speaking: false,
  };
  let spokenLines: readonly SpokenLine[] = [];
  /** Set by the `evaluate` effect: team-criterion flag, action params and the next activity. */
  let evaluation: EvaluationFacts = { outcome: { teamCriterion: false, actionParams: {} }, nextItem: null };
  /** Full evaluation result, kept for the record written by the `save` effect (T093). */
  let verdictResult: CheckinEvaluation | null = null;
  let snapshot = buildSnapshot();
  let listenToken = 0;
  const subscribers = new Set<() => void>();
  let disposed = false;

  function buildSnapshot(): CheckinSnapshot {
    return {
      step: state.step,
      paused: state.paused,
      focus: view.focus,
      caption: view.caption,
      listening: view.listening,
      outcome: state.outcome === null ? null : { ...state.outcome, ...evaluation.outcome },
      buttonsFor: view.buttonsFor,
      nextItem: evaluation.nextItem,
      saveFailed: view.saveFailed,
      readings: verdictResult === null ? [] : evaluatedReadings(verdictResult),
      speaking: view.speaking,
      spoken: spokenLines,
      pending: state.pending,
      confirmedVoice: state.confirmedVoice,
      symptoms: state.symptoms,
    };
  }

  function publish(patch: Partial<typeof view> = {}): void {
    view = { ...view, ...patch };
    snapshot = buildSnapshot();
    for (const callback of [...subscribers]) callback();
  }

  /** Ends the current listen: a superseded listen resolves without dispatching its transcript. */
  function stopListening(): void {
    listenToken += 1;
    deps.recognizer.stop();
    publish({ listening: false });
  }

  async function dispatch(event: CheckinEvent): Promise<void> {
    if (disposed) return;
    const wasPaused = state.paused;
    const transition = checkinReducer(state, event);
    state = transition.state;
    if (event.type === 'buttonAnswer') view = { ...view, buttonsFor: null };
    // A repeat or a chip answer cuts the current listen; the next prompt then listens again.
    if (event.type === 'repeat' || event.type === 'buttonAnswer' || (state.paused && !wasPaused)) {
      stopListening();
    } else {
      publish();
    }
    for (const effect of transition.effects) {
      if (disposed) return;
      await run(effect);
    }
  }

  function dispose(): void {
    disposed = true;
    listenToken += 1;
    deps.recognizer.stop();
    deps.synthesizer.cancel();
  }

  async function run(effect: Effect): Promise<void> {
    switch (effect.type) {
      case 'speak':
        return speak(effect.key, effect.params);
      case 'listen':
        // Not awaited: a listen ends when the user answers, and then dispatches its own
        // transcript. Awaiting it would hold `dispatch` and `start()` until the next answer.
        void listen(effect.grammar).catch(() => publish({ listening: false }));
        return;
      case 'setFocus':
        return publish({ focus: effect.sensor });
      case 'readDevices':
        return readDevices(effect.indicators);
      case 'evaluate': {
        const result = await deps.evaluate(state);
        verdictResult = result;
        evaluation = evaluationFacts(result, deps.agenda, deps.clock.now());
        return dispatch({
          type: 'evaluated',
          result: { verdict: result.verdict, actionKey: result.actionKey },
        });
      }
      case 'save':
        return save();
      case 'showButtons':
        return publish({ buttonsFor: effect.step });
    }
  }

  /** Caption of a line key. `next` names the next activity, or says there is none. */
  function captionFor(key: string, params?: Record<string, string | number>): string {
    if (key === 'confirm.sleep' && params?.hours === 1) return t('confirm.sleep.one');
    // Action keys take their params from the evaluation (e.g. the missing sensor's name).
    if (key !== 'next') return t(key, key.startsWith('action.') ? evaluation.outcome.actionParams : params);
    const item = nextItemAt(deps.agenda, deps.clock.now());
    if (item === null) return t('next.none');
    return t('next', { title: item.title, time: item.time });
  }

  async function speak(key: string, params?: Record<string, string | number>): Promise<void> {
    if (key === '') return;
    const caption = captionFor(key, params);
    spokenLines = [...spokenLines, { id: spokenLines.length + 1, text: caption, step: state.step }];
    publish({ caption, speaking: true });
    await deps.synthesizer.speak(caption);
    publish({ speaking: false });
    return dispatch({ type: 'spoken' });
  }

  async function listen(grammar: readonly string[]): Promise<void> {
    const token = ++listenToken;
    publish({ listening: true, buttonsFor: null });
    const text = await deps.recognizer.listen(grammar, { timeoutMs: LISTEN_TIMEOUT_MS });
    if (token !== listenToken) return; // superseded by pause, repeat or a newer listen
    publish({ listening: false });
    return dispatch({ type: 'transcript', text });
  }

  /**
   * Writes the record, then dispatches `saved`. A rejected or timed-out write still ends the
   * check-in, with `saveFailed` set so the screen can say it was not saved.
   */
  async function save(): Promise<void> {
    try {
      if (verdictResult === null) throw new Error('save before evaluation');
      const record = buildCheckRecord({
        state,
        verdict: verdictResult.verdict,
        actionKey: verdictResult.actionKey,
        readings: verdictResult.readings,
        now: deps.clock.now(),
      });
      await withTimeout(deps.repository.save(record), SAVE_TIMEOUT_MS);
    } catch {
      publish({ saveFailed: true });
    }
    return dispatch({ type: 'saved' });
  }

  async function readDevices(indicators: readonly string[]): Promise<void> {
    const observations = await readDeviceObservations(deps.devices, indicators);
    return dispatch({ type: 'devicesRead', observations });
  }

  return {
    start: () => dispatch({ type: 'start' }),
    dispatch,
    dispose,
    getSnapshot: () => snapshot,
    subscribe(callback) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}
