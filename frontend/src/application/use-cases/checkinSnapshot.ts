/**
 * Read-only view of the check-in runner (T052, T080a): what the screen reads from the runner. Kept
 * apart from the runner so that its file stays small; `runCheckin.ts` re-exports both types.
 */
import type { Observation, SensorKey, SensorReading, Symptom } from '@base-vital/contracts';
import type { CheckinState, VoiceValue } from '../../domain/checkin/checkinReducer';
import type { StepId } from '../../domain/checkin/types';
import type { CheckinSnapshotOutcome, NextItem } from './checkinEvaluation';

/** One line Vita spoke, in order. `step` is the check-in step it was spoken in (chat transcript). */
export interface SpokenLine {
  id: number;
  text: string;
  step: CheckinState['step'];
}

export interface CheckinSnapshot {
  step: CheckinState['step'];
  paused: boolean;
  focus: SensorKey | null;
  caption: string | null;
  listening: boolean;
  outcome: CheckinSnapshotOutcome | null;
  /** Step whose big buttons replace listening (two failed listens); `null` otherwise. */
  buttonsFor: StepId | null;
  /** Next activity, read when the verdict is known; `null` before that or when none is left. */
  nextItem: NextItem | null;
  /** True when the record could not be written; the check-in still ends (T093). */
  saveFailed: boolean;
  /** Readings of the evaluation for the body (T080); empty until the check is evaluated. */
  readings: SensorReading[];
  /** Observations of the check so far (device values and confirmed voice values); the markers of the summary rows (T091). */
  observations: readonly Observation[];
  /** Vita is speaking now (T080a mic indicator). */
  speaking: boolean;
  /** Every line Vita spoke, in order (T080a transcript). */
  spoken: readonly SpokenLine[];
  /** Heard value waiting for "sí" or "no" (T080a live bubble); `null` otherwise. */
  pending: VoiceValue | null;
  /** Values confirmed with "sí", in order (T080a). */
  confirmedVoice: readonly VoiceValue[];
  /** Symptoms answered (T080a). */
  symptoms: readonly Symptom[];
}
