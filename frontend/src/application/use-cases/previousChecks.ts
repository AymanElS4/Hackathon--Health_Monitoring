// Use case: the check-ins of previous days, newest first. They feed the consecutive-day rules of
// the verdict (RN2) and the "tu normal" baseline (RN3); today's own checks are left out.
import type { CheckRecord } from '@base-vital/contracts';
import type { CheckinState } from '../../domain/checkin/checkinReducer';
import type { CheckRepositoryPort, ClockPort } from '../ports';
import type { CheckinEvaluation } from './checkinEvaluation';

/** The verdict hook of the check-in runner: the reducer state and the previous days' checks. */
export type EvaluateHook = (
  state: CheckinState,
  history: readonly CheckRecord[],
) => Promise<CheckinEvaluation> | CheckinEvaluation;

/** Records saved before the local day of `now`, newest first. */
export function previousChecksBefore(records: readonly CheckRecord[], now: Date): CheckRecord[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return records
    .filter((record) => new Date(record.id).getTime() < startOfToday)
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

/** Previous days' checks from the store, as of the clock's now; a store that cannot be read gives none. */
export async function priorChecksOf(
  repository: Pick<CheckRepositoryPort, 'list'>,
  clock: ClockPort,
): Promise<CheckRecord[]> {
  try {
    return previousChecksBefore(await repository.list(), clock.now());
  } catch {
    return [];
  }
}
