import { describe, it, expect, beforeEach } from 'vitest';
import type { CheckRecord } from '@base-vital/contracts';
import { MemoryCheckRepository } from '../../../src/adapters/fakes/MemoryCheckRepository';

const reading = (sensor: string, value: string) => ({
  sensor,
  level: 'green',
  phase: 'confirmed',
  value,
  outsideNormal: false,
  teamCriterion: false,
  reason: null,
});

const readings = {
  sleep: reading('sleep', '7,5 h'),
  pulse: reading('pulse', '62 bpm'),
  pressure: reading('pressure', '112/72'),
  temperature: reading('temperature', '36,7 °C'),
  oxygen: reading('oxygen', '98 %'),
};

const makeRecord = (id: string, overrides: Partial<CheckRecord> = {}): CheckRecord => ({
  id,
  observations: [
    {
      indicator: 'resting_heart_rate',
      value: 62,
      source: 'device',
      confirmed: true,
      simulated: true,
      at: id,
    },
  ],
  symptoms: ['none'],
  readings,
  verdict: 'ok',
  actionKey: '',
  simulated: true,
  ...overrides,
} as CheckRecord);

const DAY1 = '2026-11-13T07:00:00.000Z';
const DAY2 = '2026-11-14T07:00:00.000Z';
const DAY3 = '2026-11-15T07:00:00.000Z';

describe('MemoryCheckRepository', () => {
  let repo: MemoryCheckRepository;

  beforeEach(() => {
    repo = new MemoryCheckRepository();
  });

  it('lists records newest first by id', async () => {
    await repo.save(makeRecord(DAY2));
    await repo.save(makeRecord(DAY3));
    await repo.save(makeRecord(DAY1));

    const ids = (await repo.list()).map((record) => record.id);
    expect(ids).toEqual([DAY3, DAY2, DAY1]);
  });

  it('rejects an invalid record: voice observation with confirmed false', async () => {
    const invalid = makeRecord(DAY3, {
      observations: [
        {
          indicator: 'sleep_hours',
          value: 7.5,
          source: 'voice',
          confirmed: false,
          simulated: false,
          at: DAY3,
        },
      ],
    });

    await expect(repo.save(invalid)).rejects.toThrow();
    expect(await repo.list()).toEqual([]);
  });

  it('seedIfEmpty writes only when the repository is empty', async () => {
    await repo.save(makeRecord(DAY3));
    await repo.seedIfEmpty([makeRecord(DAY1), makeRecord(DAY2)]);

    const ids = (await repo.list()).map((record) => record.id);
    expect(ids).toEqual([DAY3]);
  });

  it('seedIfEmpty writes all records when empty, newest first', async () => {
    await repo.seedIfEmpty([makeRecord(DAY1), makeRecord(DAY2)]);

    const ids = (await repo.list()).map((record) => record.id);
    expect(ids).toEqual([DAY2, DAY1]);
  });

  it('clear empties the repository', async () => {
    await repo.save(makeRecord(DAY1));
    await repo.save(makeRecord(DAY2));

    await repo.clear();

    expect(await repo.list()).toEqual([]);
  });
});
