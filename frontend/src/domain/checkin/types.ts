/**
 * Types of the daily check-in flow (T048). Types only: no runtime code.
 *
 * `StepKind` is owned by the parser (T046) and re-exported here so the script and
 * the reducer share one definition.
 */
import type { Indicator, Observation, SensorKey, Verdict } from '@base-vital/contracts';
import type { StepKind } from '../parsing/parseUtterance';

export type { StepKind };

/** Every step of the check-in, plus the states that are not steps of the script. */
export type StepId =
  | 'greeting'
  | 'ask_sleep'
  | 'confirm_sleep'
  | 'ask_mood'
  | 'confirm_mood'
  | 'ask_symptoms'
  | 'measuring'
  | 'summary'
  | 'next_activity';

/** Vosk word lists of one listening step, per voice language (006). */
export interface StepGrammar {
  readonly es: readonly string[];
  readonly en: readonly string[];
}

/** One step of the script. The script is data; the reducer executes it. */
export interface CheckinStep {
  id: StepId;
  kind: 'say' | 'ask' | 'confirm' | 'measure' | 'summary' | 'next';
  /** Key into `messages.es.ts`. */
  messageKey: string;
  /** Which parser reading applies to the answer. */
  parse?: StepKind;
  /** Vosk grammar for the listening phase, one word list per voice language. */
  grammar?: StepGrammar;
  /** Body sensor to highlight while the step runs; `null` clears the focus. */
  focus?: SensorKey | null;
  indicator?: Indicator;
}

export type CheckinScript = readonly CheckinStep[];

export type CheckinEvent =
  | { type: 'start' }
  | { type: 'transcript'; text: string | null }
  | { type: 'spoken' }
  /**
   * Device observations of one stage. `pulseOutsideNormal` is sent with the pulse read only (CL4,
   * D33): true when the pulse is outside "tu normal" (RN3). Absent on the other reads.
   */
  | { type: 'devicesRead'; observations: Observation[]; pulseOutsideNormal?: boolean }
  | { type: 'evaluated'; result: { verdict: Verdict; actionKey: string } }
  | { type: 'saved' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'repeat' }
  /** A big-button answer, handled like a transcript (shown after two failed listens). */
  | { type: 'buttonAnswer'; text: string };

export type Effect =
  | { type: 'speak'; key: string; params?: Record<string, string | number> }
  | { type: 'listen'; grammar: readonly string[] }
  | { type: 'setFocus'; sensor: SensorKey | null }
  | { type: 'readDevices'; indicators: readonly Indicator[] }
  | { type: 'evaluate' }
  | { type: 'save' }
  | { type: 'showButtons'; step: StepId };
