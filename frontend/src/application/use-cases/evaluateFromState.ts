/**
 * Maps the check-in state onto `evaluateCheck` (T068, CA4). The runner calls it through the
 * `evaluate` hook when measuring is done. Voice values reach the verdict only once confirmed
 * (Principle IX). Device values are already confirmed on arrival. History is empty until T088.
 */
import { Observation } from '@base-vital/contracts';
import { evaluateCheck, type EvaluateResult } from '@base-vital/health-rules';
import type { CheckinState } from '../../domain/checkin/checkinReducer';
import { formatReadingValue } from './formatReadingValue';

export interface EvaluateFromStateOptions {
  /** ISO date-time stamped on the voice observations. */
  at: string;
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
    history: [],
    formatValue: formatReadingValue,
  });
}
