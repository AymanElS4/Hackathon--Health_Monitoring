import type { ClockPort } from '../../application/ports';

/** Real clock: the current system date and time. */
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
