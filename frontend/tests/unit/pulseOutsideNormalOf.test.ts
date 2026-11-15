/**
 * The CL4 pulse check reads only the previous days' checks (RN3). A check saved earlier today must
 * not count as history for a second check the same day.
 */
import { describe, it, expect } from 'vitest';
import type { CheckRecord, Observation, SensorKey, SensorReading } from '@base-vital/contracts';
import { pulseOutsideNormalOf } from '../../src/application/use-cases/pulseOutsideNormal';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';

const NOW = new Date(2026, 10, 15, 9, 30);

const reading = (sensor: SensorKey): SensorReading => ({
  sensor,
  level: 'green',
  phase: 'confirmed',
  value: '-',
  outsideNormal: false,
  teamCriterion: false,
  reason: null,
});

/** One saved check at 08:00 local, `daysAgo` days before NOW (0 = today), with a resting pulse. */
function checkAt(daysAgo: number, pulse: number, hour = 8, minute = 0): CheckRecord {
  const at = new Date(2026, 10, 15 - daysAgo, hour, minute).toISOString();
  const observation: Observation = {
    indicator: 'resting_heart_rate',
    value: pulse,
    source: 'device',
    confirmed: true,
    simulated: true,
    at,
  };
  return {
    id: at,
    observations: [observation],
    symptoms: [],
    readings: {
      sleep: reading('sleep'),
      pulse: reading('pulse'),
      pressure: reading('pressure'),
      temperature: reading('temperature'),
      oxygen: reading('oxygen'),
    },
    verdict: 'ok',
    actionKey: '',
    simulated: true,
  };
}

/** The first 14 days (days 3–16 before NOW) alternate 59 and 65 bpm: mean 62, SD 3 (floored). */
function baselineDays(): CheckRecord[] {
  return Array.from({ length: 14 }, (_, index) => checkAt(index + 3, index % 2 === 0 ? 65 : 59));
}

const todayPulse = (pulse: number): Observation => ({
  indicator: 'resting_heart_rate',
  value: pulse,
  source: 'device',
  confirmed: true,
  simulated: true,
  at: NOW.toISOString(),
});

describe('pulseOutsideNormalOf: previous days only', () => {
  it('does not count a check saved earlier today as history', async () => {
    const repository = new MemoryCheckRepository();
    // Previous days: 72 bpm yesterday and the day before (outside 62 ± 6). Today's first check
    // (62 bpm, normal) was saved earlier; the second check reads 72 bpm.
    await repository.seedIfEmpty([
      ...baselineDays(),
      checkAt(1, 72),
      checkAt(2, 72),
      checkAt(0, 62, 7, 0),
    ]);
    const outside = await pulseOutsideNormalOf(repository, new FixedClock(NOW), [todayPulse(72)]);
    // Last 3 values: today's 72 and the two previous days' 72 → outside. Counting the earlier check
    // today (62) would break the run and give false.
    expect(outside).toBe(true);
  });

  it('is false when the previous days are normal, whatever was saved today', async () => {
    const repository = new MemoryCheckRepository();
    await repository.seedIfEmpty([
      ...baselineDays(),
      checkAt(1, 62),
      checkAt(2, 62),
      checkAt(0, 72, 7, 0),
    ]);
    const outside = await pulseOutsideNormalOf(repository, new FixedClock(NOW), [todayPulse(72)]);
    expect(outside).toBe(false);
  });
});
