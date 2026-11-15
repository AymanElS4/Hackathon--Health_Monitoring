import type { ClockPort } from '../../application/ports';

/** Fake clock that always returns the same date (tests and demo scenarios). */
export class FixedClock implements ClockPort {
  private readonly date: Date;

  constructor(date: Date) {
    this.date = new Date(date.getTime());
  }

  now(): Date {
    return new Date(this.date.getTime());
  }
}
