/**
 * Simulated history (T088, FR-013, U1). The seed is pure: the same scenario and clock always give
 * the same 14 records, each valid against CheckRecord and marked simulated.
 */
import { describe, it, expect } from 'vitest';
import { CheckRecord, type DemoScenarioId } from '@base-vital/contracts';
import { levelFor } from '@base-vital/health-rules';
import sleepHistory from '../../data/sleep-history.json';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import {
  SEED_DAYS,
  buildSeedHistory,
  reseedScenario,
  seedIfEmpty,
} from '../../src/application/use-cases/seedHistory';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';

const NOW = new Date(2026, 10, 15, 14, 0);
const SCENARIO_IDS = Object.keys(DEMO_SCENARIOS) as DemoScenarioId[];

/** Sleep in hours of a record, from its observations. */
function sleepOf(record: CheckRecord): number | undefined {
  const observation = record.observations.find((o) => o.indicator === 'sleep_hours');
  return observation && typeof observation.value === 'number' ? observation.value : undefined;
}

function valueOf(record: CheckRecord, indicator: string): unknown {
  return record.observations.find((o) => o.indicator === indicator)?.value;
}

/** Local calendar day of a record's id. */
function dayOf(record: CheckRecord): string {
  return new Date(record.id).toDateString();
}

describe('buildSeedHistory', () => {
  it('is deterministic: the same scenario and clock give the same records', () => {
    const first = buildSeedHistory(DEMO_SCENARIOS.ca4, { now: NOW });
    const second = buildSeedHistory(DEMO_SCENARIOS.ca4, { now: NOW });
    expect(second).toEqual(first);
  });

  it('gives 14 records, one per local day before today, at 09:30, oldest first', () => {
    const records = buildSeedHistory(DEMO_SCENARIOS.normal, { now: NOW });
    expect(records).toHaveLength(SEED_DAYS);
    const expectedDays = Array.from({ length: SEED_DAYS }, (_, i) =>
      new Date(2026, 10, 15 - (SEED_DAYS - i)).toDateString(),
    );
    expect(records.map(dayOf)).toEqual(expectedDays);
    for (const record of records) {
      const at = new Date(record.id);
      expect([at.getHours(), at.getMinutes()]).toEqual([9, 30]);
    }
    expect(new Set(records.map((r) => r.id)).size).toBe(SEED_DAYS);
  });

  it('marks every record simulated and keeps each record valid against CheckRecord', () => {
    for (const id of SCENARIO_IDS) {
      const records = buildSeedHistory(DEMO_SCENARIOS[id], { now: NOW });
      for (const record of records) {
        expect(record.simulated).toBe(true);
        expect(CheckRecord.parse(record)).toEqual(record);
      }
    }
  });

  it('uses the first 12 Sleep-EDF nights and ends with the scenario priorNights (yesterday last)', () => {
    const records = buildSeedHistory(DEMO_SCENARIOS.normal, { now: NOW });
    const expectedEarlier = sleepHistory.hours.slice(0, SEED_DAYS - 2).map((h) => Math.floor(h * 2) / 2);
    expect(records.slice(0, SEED_DAYS - 2).map(sleepOf)).toEqual(expectedEarlier);
    // priorNights = [yesterday, the day before] = [7.2, 7.8]; stored in half hours, rounded down.
    expect(records.slice(-2).map(sleepOf)).toEqual([7.5, 7]);
    expect(sleepOf(records[SEED_DAYS - 1])).toBe(7);
    expect(sleepOf(records[SEED_DAYS - 2])).toBe(7.5);
  });

  it('keeps the last two sleep values equal to priorNights for every scenario', () => {
    for (const id of SCENARIO_IDS) {
      const scenario = DEMO_SCENARIOS[id];
      const [yesterday, dayBefore] = scenario.priorNights;
      const records = buildSeedHistory(scenario, { now: NOW });
      expect(sleepOf(records[SEED_DAYS - 1])).toBe(Math.floor(yesterday * 2) / 2);
      expect(sleepOf(records[SEED_DAYS - 2])).toBe(Math.floor(dayBefore * 2) / 2);
    }
  });

  it('keeps vitals in green with the stated variation around the scenario values', () => {
    for (const id of SCENARIO_IDS) {
      const records = buildSeedHistory(DEMO_SCENARIOS[id], { now: NOW });
      for (const record of records) {
        for (const sensor of ['pressure', 'pulse', 'temperature', 'oxygen'] as const) {
          expect(record.readings[sensor]?.level).toBe('green');
        }
      }
    }
    const normal = buildSeedHistory(DEMO_SCENARIOS.normal, { now: NOW });
    for (const record of normal) {
      const pressure = valueOf(record, 'blood_pressure') as { systolic: number; diastolic: number };
      expect(Math.abs(pressure.systolic - 112)).toBeLessThanOrEqual(4);
      expect(Math.abs(pressure.diastolic - 72)).toBeLessThanOrEqual(3);
      expect(Math.abs((valueOf(record, 'resting_heart_rate') as number) - 64)).toBeLessThanOrEqual(3);
      expect(Math.abs((valueOf(record, 'body_temperature') as number) - 36.6)).toBeLessThanOrEqual(0.2 + 1e-9);
      expect(Math.abs((valueOf(record, 'oxygen_saturation') as number) - 98)).toBeLessThanOrEqual(1);
    }
  });

  it('stays green for ca4 blood pressure (118 systolic is near the limit) and low_temp temperature', () => {
    const ca4 = buildSeedHistory(DEMO_SCENARIOS.ca4, { now: NOW });
    for (const record of ca4) {
      const pressure = valueOf(record, 'blood_pressure') as { systolic: number; diastolic: number };
      expect(pressure.systolic).toBeLessThan(120);
      expect(Math.abs(pressure.systolic - 118)).toBeLessThanOrEqual(4);
      expect(Math.abs(pressure.diastolic - 76)).toBeLessThanOrEqual(3);
    }
    // 35.6 °C is in doubt, not green: the seeded days use the normal scenario's temperature.
    const lowTemp = buildSeedHistory(DEMO_SCENARIOS.low_temp, { now: NOW });
    for (const record of lowTemp) {
      expect(Math.abs((valueOf(record, 'body_temperature') as number) - 36.6)).toBeLessThanOrEqual(0.2 + 1e-9);
    }
  });

  it('gives missing_sensor a blood pressure history (the sensor only fails today)', () => {
    const records = buildSeedHistory(DEMO_SCENARIOS.missing_sensor, { now: NOW });
    for (const record of records) {
      expect(valueOf(record, 'blood_pressure')).toBeDefined();
    }
  });

  it('gives mood 4 or 5 on every day', () => {
    const records = buildSeedHistory(DEMO_SCENARIOS.normal, { now: NOW });
    for (const record of records) {
      expect([4, 5]).toContain(valueOf(record, 'mood'));
    }
  });

  it('confirms voice observations and marks every seeded observation simulated', () => {
    const records = buildSeedHistory(DEMO_SCENARIOS.normal, { now: NOW });
    for (const record of records) {
      for (const observation of record.observations) {
        expect(observation.simulated).toBe(true);
        expect(observation.confirmed).toBe(true);
        if (observation.source === 'voice') {
          expect(['sleep_hours', 'mood']).toContain(observation.indicator);
        }
      }
    }
  });

  it('uses the WESAD series for pulse when it has values in band, else scenario ±3', () => {
    const series = [58, 61, 70, 95, 101, 66, 80];
    const withSeries = buildSeedHistory(DEMO_SCENARIOS.normal, { now: NOW, wesadSeries: series });
    for (const record of withSeries) {
      expect(series.filter((bpm) => bpm >= 60 && bpm <= 100)).toContain(valueOf(record, 'resting_heart_rate'));
    }
    const withoutSeries = buildSeedHistory(DEMO_SCENARIOS.normal, { now: NOW });
    for (const record of withoutSeries) {
      expect(Math.abs((valueOf(record, 'resting_heart_rate') as number) - 64)).toBeLessThanOrEqual(3);
    }
  });

  it('gives the history a non-zero spread, so "tu normal" never has SD 0 for pulse or temperature', () => {
    const records = buildSeedHistory(DEMO_SCENARIOS.normal, { now: NOW });
    const pulses = new Set(records.map((r) => valueOf(r, 'resting_heart_rate')));
    const temperatures = new Set(records.map((r) => valueOf(r, 'body_temperature')));
    expect(pulses.size).toBeGreaterThan(1);
    expect(temperatures.size).toBeGreaterThan(1);
  });

  it('marks a short night as attention with the slept-little action (verdict of the seeded day)', () => {
    const records = buildSeedHistory(DEMO_SCENARIOS.normal, { now: NOW });
    // Sleep 3.5 h (the Sleep-EDF night of 3.9 h) is amber on its own: one amber is attention.
    const shortNight = records.find((r) => sleepOf(r) === 3.5);
    expect(shortNight?.verdict).toBe('attention');
    expect(shortNight?.actionKey).toBe('action.slept_little');
    expect(levelFor('sleep_hours', 3.5).level).toBe('amber');
  });
});

describe('seedIfEmpty and reseedScenario', () => {
  it('writes the 14 days once: a second call does not duplicate them', async () => {
    const repository = new MemoryCheckRepository();
    await seedIfEmpty(repository, DEMO_SCENARIOS.normal, { now: NOW });
    await seedIfEmpty(repository, DEMO_SCENARIOS.normal, { now: NOW });
    expect(await repository.list()).toHaveLength(SEED_DAYS);
  });

  it('reseedScenario replaces the store with the history of the new scenario', async () => {
    const repository = new MemoryCheckRepository();
    await seedIfEmpty(repository, DEMO_SCENARIOS.normal, { now: NOW });
    await reseedScenario(repository, DEMO_SCENARIOS.ca4, { now: NOW });
    const records = await repository.list();
    expect(records).toHaveLength(SEED_DAYS);
    expect(records).toEqual([...buildSeedHistory(DEMO_SCENARIOS.ca4, { now: NOW })].reverse());
  });
});
