/**
 * Maps the check-in state onto `evaluateCheck` (T068, CA4). The runner calls it through the
 * `evaluate` hook when measuring is done. Voice values reach the verdict only once confirmed
 * (Principle IX). Device values are already confirmed on arrival.
 */
import { Observation, type CheckRecord } from '@base-vital/contracts';
import { evaluateCheck, type EvaluateResult } from '@base-vital/health-rules';
import type { CheckinState } from '../../domain/checkin/checkinReducer';
import { formatReadingValue } from './formatReadingValue';

export interface EvaluateFromStateOptions {
  /** ISO date-time stamped on the voice observations. */
  at: string;
  /** Previous days' checks, newest first; empty when there is no history. */
  history?: readonly CheckRecord[];
}

export function evaluateFromState(
  state: CheckinState,
  opts: EvaluateFromStateOptions,
): EvaluateResult {
  const voice = state.confirmedVoice.map((value) =>
    Observation.parse({
      indicator: value.indicator,
      value: value.value,
      source: 'voice',
      confirmed: true,
      simulated: false,
      at: opts.at,
    }),
  );
  return evaluateCheck({
    observations: [...voice, ...state.confirmed],
    symptoms: state.symptoms,
    history: opts.history ?? [],
    inDoubt: state.inDoubt,
    formatValue: formatReadingValue,
  });
}
