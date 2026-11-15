import { describe, expect, it } from 'vitest';
import { DEMO_CREW_ID, demoSyncChecks } from '../../scripts/demo-checks';
import { InMemoryCheckRepository } from '../../src/adapters/memory/in-memory-check-repository';
import { getCrewSummary } from '../../src/application/use-cases/get-crew-summary';
import { ingestCheck } from '../../src/application/use-cases/ingest-check';
import { SyncCheck } from '../../src/domain/sync-check';

const DEMO_DAY_COUNT = 14;
const SHORT_SLEEP_COUNT = 2;
const SHORT_SLEEP_HOURS = 5;

type Body = SyncCheck;

describe('demoSyncChecks', () => {
  it('returns 14 bodies that all parse as SyncCheck', () => {
    const bodies = demoSyncChecks();
    expect(bodies).toHaveLength(DEMO_DAY_COUNT);
    for (const body of bodies) {
      expect(SyncCheck.safeParse(body).success).toBe(true);
    }
  });

  it('marks every check and every observation as simulated', () => {
    for (const body of demoSyncChecks() as Body[]) {
      expect(body.check.simulated).toBe(true);
      for (const observation of body.check.observations) {
        expect(observation.simulated).toBe(true);
      }
    }
  });

  it('uses unique clientCheckIds', () => {
    const ids = (demoSyncChecks() as Body[]).map((body) => body.clientCheckId);
    expect(new Set(ids).size).toBe(DEMO_DAY_COUNT);
  });

  it('belongs to the demo crew with mission days 9..22', () => {
    const bodies = demoSyncChecks() as Body[];
    expect(bodies.every((body) => body.crewId === DEMO_CREW_ID)).toBe(true);
    expect(bodies.map((body) => body.missionDay)).toEqual(
      Array.from({ length: DEMO_DAY_COUNT }, (_, index) => index + 9),
    );
  });

  it('has exactly two attention days with short sleep', () => {
    const bodies = demoSyncChecks() as Body[];
    const attention = bodies.filter((body) => body.check.verdict === 'attention');
    expect(attention).toHaveLength(SHORT_SLEEP_COUNT);
    for (const body of attention) {
      expect(body.check.actionKey).toBe('action.slept_little');
      const sleepReading = body.check.readings.sleep;
      expect(sleepReading?.level).toBe('amber');
      expect(sleepReading?.reason).toBe('sleep_hours');
      expect(sleepReading?.teamCriterion).toBe(false);
      expect(sleepReading?.outsideNormal).toBe(true);
      const sleep = body.check.observations.find((o) => o.indicator === 'sleep_hours');
      expect(sleep?.value).toBe(SHORT_SLEEP_HOURS);
    }
    const ok = bodies.filter((body) => body.check.verdict === 'ok');
    expect(ok.every((body) => body.check.actionKey === '')).toBe(true);
  });

  it('is deterministic across calls', () => {
    expect(demoSyncChecks()).toEqual(demoSyncChecks());
  });

  it('ingests as 14 created, then 14 duplicates, and yields a 14-day history', async () => {
    const repo = new InMemoryCheckRepository();
    const bodies = demoSyncChecks();

    const first = [];
    for (const body of bodies) first.push((await ingestCheck(repo, body)).status);
    expect(first.filter((status) => status === 'created')).toHaveLength(DEMO_DAY_COUNT);

    const second = [];
    for (const body of bodies) second.push((await ingestCheck(repo, body)).status);
    expect(second.filter((status) => status === 'duplicate')).toHaveLength(DEMO_DAY_COUNT);

    const summary = await getCrewSummary(repo, DEMO_CREW_ID);
    expect(summary?.history).toHaveLength(DEMO_DAY_COUNT);
    expect(summary?.missionStartDate).toBe('2026-10-24');
  });
});
