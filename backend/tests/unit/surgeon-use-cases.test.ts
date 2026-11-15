import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemoryCheckRepository } from '../../src/adapters/memory/in-memory-check-repository';
import type { CheckRepository } from '../../src/application/ports/check-repository.port';
import { getCrewSummary } from '../../src/application/use-cases/get-crew-summary';
import { listCrew } from '../../src/application/use-cases/list-crew';
import { SyncCheck } from '../../src/domain/sync-check';
import { toStoredCheck } from '../../src/domain/to-stored-check';
import type { Verdict } from '../../src/shared/contracts';
import { validSyncCheck } from '../fixtures/sync-check.builder';

const CREW_A = 'crew-aaaaaa';
const CREW_B = 'crew-bbbbbb';
const CREW_C = 'crew-cccccc';
const UNKNOWN_CREW = 'crew-zzzzzz';
const LATEST_DAY = '2026-11-15';
const MISSION_DAY = 23;

/** Builds a valid, stored check for a crew at an instant, with the given verdict. */
async function save(
  repo: CheckRepository,
  crewId: string,
  completedAt: string,
  verdict: Verdict,
  missionDay = MISSION_DAY,
): Promise<void> {
  const body = structuredClone(validSyncCheck());
  body.clientCheckId = randomUUID();
  body.crewId = crewId;
  body.missionDay = missionDay;
  body.check.id = completedAt;
  body.check.verdict = verdict;
  body.check.actionKey = verdict === 'ok' ? '' : `action.${verdict}`;
  body.check.observations = body.check.observations.map((observation) => ({
    ...observation,
    at: completedAt,
  }));
  const { check, alert } = toStoredCheck(SyncCheck.parse(body));
  await repo.saveCheck(check, alert);
}

describe('listCrew', () => {
  it('orders alert, then attention, then ok, regardless of insertion order', async () => {
    const repo = new InMemoryCheckRepository();
    await save(repo, CREW_A, `${LATEST_DAY}T08:00:00.000Z`, 'ok');
    await save(repo, CREW_B, `${LATEST_DAY}T07:00:00.000Z`, 'alert');
    await save(repo, CREW_C, `${LATEST_DAY}T09:00:00.000Z`, 'attention');

    const crew = await listCrew(repo);
    expect(crew.map((entry) => entry.crewId)).toEqual([CREW_B, CREW_C, CREW_A]);
    expect(crew.map((entry) => entry.verdict)).toEqual(['alert', 'attention', 'ok']);
  });

  it('uses the most recent check of each crew member', async () => {
    const repo = new InMemoryCheckRepository();
    await save(repo, CREW_A, `${LATEST_DAY}T08:00:00.000Z`, 'ok');
    await save(repo, CREW_A, `2026-11-14T08:00:00.000Z`, 'alert', MISSION_DAY - 1);

    const crew = await listCrew(repo);
    expect(crew).toHaveLength(1);
    expect(crew[0]?.verdict).toBe('ok');
    expect(crew[0]?.completedAt).toBe(`${LATEST_DAY}T08:00:00.000Z`);
  });

  it('returns an empty list when there are no checks', async () => {
    expect(await listCrew(new InMemoryCheckRepository())).toEqual([]);
  });
});

describe('getCrewSummary', () => {
  it('returns null for an unknown crew', async () => {
    const repo = new InMemoryCheckRepository();
    await save(repo, CREW_A, `${LATEST_DAY}T08:00:00.000Z`, 'ok');

    expect(await getCrewSummary(repo, UNKNOWN_CREW)).toBeNull();
  });

  it('returns the crew, the latest check and the history, newest first', async () => {
    const repo = new InMemoryCheckRepository();
    await save(repo, CREW_A, `${LATEST_DAY}T08:00:00.000Z`, 'ok');
    await save(repo, CREW_A, `${LATEST_DAY}T01:00:00.000Z`, 'ok');
    await save(repo, CREW_A, '2026-11-14T08:00:00.000Z', 'attention', MISSION_DAY - 1);
    await save(repo, CREW_A, '2026-11-02T08:00:00.000Z', 'ok');

    const summary = await getCrewSummary(repo, CREW_A);
    expect(summary).not.toBeNull();
    if (!summary) return;
    expect(summary.crewId).toBe(CREW_A);
    expect(summary.missionStartDate).toBe('2026-10-24');
    expect(summary.latest.completedAt).toBe(`${LATEST_DAY}T08:00:00.000Z`);
    expect(summary.history.map((check) => check.completedAt)).toEqual([
      `${LATEST_DAY}T08:00:00.000Z`,
      `${LATEST_DAY}T01:00:00.000Z`,
      '2026-11-14T08:00:00.000Z',
      '2026-11-02T08:00:00.000Z',
    ]);
    expect(summary.history[0]?.id).toBe(summary.latest.id);
  });

  it('limits history to the 14 calendar days ending on the latest check day', async () => {
    const repo = new InMemoryCheckRepository();
    // Day 0 (latest), -13 (first day of the window) and -14 (outside the window).
    await save(repo, CREW_A, `${LATEST_DAY}T08:00:00.000Z`, 'ok');
    await save(repo, CREW_A, '2026-11-02T08:00:00.000Z', 'ok');
    await save(repo, CREW_A, '2026-11-01T08:00:00.000Z', 'ok');

    const summary = await getCrewSummary(repo, CREW_A);
    expect(summary).not.toBeNull();
    if (!summary) return;
    expect(summary.history.map((check) => check.completedAt)).toEqual([
      `${LATEST_DAY}T08:00:00.000Z`,
      '2026-11-02T08:00:00.000Z',
    ]);
  });
});
