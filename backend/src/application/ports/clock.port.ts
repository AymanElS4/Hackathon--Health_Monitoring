/** Injection token for the clock (bound in `app.module.ts`). */
export const CLOCK = Symbol('CLOCK');

/** Source of the current instant, so use cases stay deterministic in tests. */
export interface Clock {
  /** Current instant as an ISO date-time string. */
  nowIso(): string;
}
