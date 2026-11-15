import type { Clock } from '../ports/clock.port';
import type { AlertDecision, CheckRepository, DecideResult } from '../ports/check-repository.port';

/** Decisions a surgeon may record on an alert; must match the `alerts.decision` SQL list. */
export const ALERT_DECISIONS = ['manage_on_base', 'consult_surgeon', 'prepare_return'] as const;

/** Outcome of a decision attempt; `invalid_decision` means the value is not in `ALERT_DECISIONS`. */
export type DecideAlertResult = DecideResult | { status: 'invalid_decision' };

function isAlertDecision(value: unknown): value is AlertDecision {
  return typeof value === 'string' && (ALERT_DECISIONS as readonly string[]).includes(value);
}

/**
 * Records the surgeon's decision on an open alert, stamped with the clock instant.
 * Invalid decisions are rejected before the repository is touched.
 */
export async function decideAlert(
  repo: CheckRepository,
  clock: Clock,
  id: string,
  decision: unknown,
): Promise<DecideAlertResult> {
  if (!isAlertDecision(decision)) {
    return { status: 'invalid_decision' };
  }
  return repo.decideAlert(id, decision, clock.nowIso());
}
