import { describe, it, expect } from 'vitest';
import { missionDay, lightPhase } from '../../src/domain/mission/missionClock';
import {
  MISSION,
  LUNAR_LIGHT_DAYS,
  LUNAR_DARK_DAYS,
  LUNAR_CYCLE_OFFSET_DAYS,
} from '../../src/config/mission';

// Test files are exempt from no-magic-numbers.
// Dates are built with the local constructor: mission days follow the local calendar.
const start = new Date(2026, 0, 1);
/** Same wall-clock time, `n` local calendar days later (no DST shifts in the arithmetic). */
const plusDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

describe('missionDay', () => {
  it('is day 1 on the start date', () => {
    expect(missionDay(start, start)).toBe(1);
  });

  it('is day 23 twenty-two days after the start date', () => {
    expect(missionDay(start, plusDays(start, 22))).toBe(23);
  });

  it('counts whole local calendar days regardless of time of day', () => {
    expect(missionDay(start, new Date(2026, 0, 1, 23, 59, 59))).toBe(1);
    expect(missionDay(start, new Date(2026, 0, 2, 0, 0, 0))).toBe(2);
  });

  it('still counts the start date as day 1 at 20:00 local time, and day 23 twenty-two days later', () => {
    const evening = new Date(2026, 0, 1, 20, 0);
    expect(missionDay(evening, new Date(2026, 0, 1, 20, 0))).toBe(1);
    expect(missionDay(evening, new Date(2026, 0, 23, 20, 0))).toBe(23);
  });

  it('clamps dates before the start to day 1', () => {
    expect(missionDay(start, plusDays(start, -5))).toBe(1);
  });
});

describe('lightPhase', () => {
  it('is light day 1 on the start date when there is no offset', () => {
    expect(lightPhase(start, start, 14, 14)).toEqual({ kind: 'light', day: 1, of: 14 });
  });

  it('is light day 14 on the last light day and dark day 1 the day after', () => {
    expect(lightPhase(start, plusDays(start, 13), 14, 14)).toEqual({ kind: 'light', day: 14, of: 14 });
    expect(lightPhase(start, plusDays(start, 14), 14, 14)).toEqual({ kind: 'dark', day: 1, of: 14 });
  });

  it('is dark day 14 at the end of the dark phase and light day 1 again on day 29', () => {
    expect(lightPhase(start, plusDays(start, 27), 14, 14)).toEqual({ kind: 'dark', day: 14, of: 14 });
    expect(lightPhase(start, plusDays(start, 28), 14, 14)).toEqual({ kind: 'light', day: 1, of: 14 });
  });

  it('returns to the same phase after a full 28-day cycle', () => {
    for (const n of [0, 5, 13, 14, 20]) {
      expect(lightPhase(start, plusDays(start, n + 28), 14, 14)).toEqual(
        lightPhase(start, plusDays(start, n), 14, 14),
      );
    }
  });

  it('applies the cycle offset so that the offset shifts the phase', () => {
    // Offset 14: mission day 1 sits at dark day 1, light starts on mission day 15.
    expect(lightPhase(start, start, 14, 14, 14)).toEqual({ kind: 'dark', day: 1, of: 14 });
    expect(lightPhase(start, plusDays(start, 14), 14, 14, 14)).toEqual({ kind: 'light', day: 1, of: 14 });
  });

  it('clamps dates before the start to the phase of day 1', () => {
    const before = plusDays(start, -10);
    expect(lightPhase(start, before, 14, 14, 14)).toEqual(lightPhase(start, start, 14, 14, 14));
  });
});

describe('configured mission example', () => {
  // Same parse as the Home view: the ISO start date is a local calendar day.
  const [year, month, day] = MISSION.missionStartDate.split('-').map(Number);
  const missionStart = new Date(year, month - 1, day);
  const now = new Date(2026, 10, 15, 12, 0);

  it('puts 2026-11-15 on mission day 23', () => {
    expect(missionDay(missionStart, now)).toBe(23);
  });

  it('puts 2026-11-15 in light day 9 of 14', () => {
    expect(
      lightPhase(missionStart, now, LUNAR_LIGHT_DAYS, LUNAR_DARK_DAYS, LUNAR_CYCLE_OFFSET_DAYS),
    ).toEqual({ kind: 'light', day: 9, of: 14 });
  });

  it('still puts 2026-11-15 on mission day 23 at 20:00 local time', () => {
    expect(missionDay(missionStart, new Date(2026, 10, 15, 20, 0))).toBe(23);
  });
});
