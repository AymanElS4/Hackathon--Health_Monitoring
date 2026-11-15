/**
 * Builds the stored CheckRecord of a finished check-in (T093, US6). Pure: the state, the
 * evaluation and the clock are passed in. Only confirmed voice values are kept (Principle IX):
 * `confirmedVoice`, never the pending value.
 */
import {
  CheckRecord,
  Observation,
  type SensorKey,
  type SensorReading,
  type Verdict,
} from '@base-vital/contracts';
import type { CheckinState, VoiceValue } from '../../domain/checkin/checkinReducer';

export interface BuildCheckRecordInput {
  state: CheckinState;
  verdict: Verdict;
  actionKey: string;
  readings: Record<SensorKey, SensorReading>;
  /** Clock reading at save time; its ISO form is the record id (read by Home as a Date). */
  now: Date;
}

function voiceObservation(value: VoiceValue, at: string): Observation {
  return Observation.parse({
    indicator: value.indicator,
    value: value.value,
    source: 'voice',
    confirmed: true,
    simulated: false,
    at,
  });
}

/** The observations of a check: confirmed voice values first, then the device values (the record's order). */
export function observationsOf(state: CheckinState, at: string): Observation[] {
  return [...state.confirmedVoice.map((value) => voiceObservation(value, at)), ...state.confirmed];
}

/** A parsed record of a real check-in: `simulated` is false. Throws when the record is invalid. */
export function buildCheckRecord(input: BuildCheckRecordInput): CheckRecord {
  const at = input.now.toISOString();
  return CheckRecord.parse({
    id: at,
    observations: observationsOf(input.state, at),
    symptoms: input.state.symptoms,
    readings: input.readings,
    verdict: input.verdict,
    actionKey: input.actionKey,
    simulated: false,
  });
}
