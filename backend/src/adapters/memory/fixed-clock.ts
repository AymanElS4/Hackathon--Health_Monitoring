import type { Clock } from '../../application/ports/clock.port';

/** Test clock that always answers the instant held in `value`; set `value` to move time. */
export class FixedClock implements Clock {
  constructor(public value: string) {}

  nowIso(): string {
    return this.value;
  }
}
