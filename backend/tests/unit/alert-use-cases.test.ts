import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryCheckRepository } from '../../src/adapters/memory/in-memory-check-repository';
import { FixedClock } from '../../src/adapters/memory/fixed-clock';
import type { CheckRepository } from '../../src/application/ports/check-repository.port';
import { decideAlert } from '../../src/application/use-cases/decide-alert';
import { listAlerts } from '../../src/application/use-cases/list-alerts';
import { SyncCheck } from '../../src/domain/sync-check';
import { toStoredCheck } from '../../src/domain/to-stored-check';
import type { Verdict } from '../../src/shared/contracts';
import { validSyncCheck } from '../fixtures/sync-check.builder';

const CREW_A = 'crew-aaaaaa';
const CREW_B = 'crew-bbbbbb';
const CREW_C = 'crew-cccccc';
const MISSION_DAY = 23;
const DAY = '2026-11-15';
const ACTION_KEY = 'action.alert';

/** Saves a check for a crew member with the given verdict; `createdAt` of its alert is `repo.now()`. */
async function save(
  repo: InMemoryCheckRepository,
  crewId: string,
  verdict: Verdict,
  createdAt: string,
): Promise<void> {
  const body = structuredClone(validSyncCheck());
  body.clientCheckId = randomUUID();
  body.crewId = crewId;
  body.missionDay = MISSION_DAY;
  body.check.id = createdAt;
  body.check.verdict = verdict;
  body.check.actionKey = verdict === 'ok' ? '' : ACTION_KEY;
  body.check.observations = body.check.observations.map((observation) => ({
    ...observation,
    at: createdAt,
  }));
  const { check, alert } = toStoredCheck(SyncCheck.parse(body));
  repo.now = () => createdAt;
  await repo.saveCheck(check, alert);
}

/** Saves a check and returns the id of the alert it opened (fails when it opened none). */
async function saveWithAlert(
  repo: InMemoryCheckRepository,
  crewId: string,
  verdict: Verdict,
  createdAt: string,
): Promise<string> {
  await save(repo, crewId, verdict, createdAt);
  const open = await repo.listOpenAlerts();
  const alert = open.find((entry) => entry.crewId === crewId && entry.createdAt === createdAt);
  if (!alert) {
    throw new Error(`no alert opened for ${crewId} at ${createdAt}`);
  }
  return alert.id;
}

describe('listAlerts', () => {
  it('orders now before soon, then oldest first within the same urgency', async () => {
    const repo = new InMemoryCheckRepository();
    // Inserted out of order on purpose: the use case must sort, not rely on insertion order.
    await save(repo, CREW_A, 'attention', `${DAY}T10:00:00.000Z`); // soon, newest
    await save(repo, CREW_B, 'alert', `${DAY}T09:00:00.000Z`); // now, newer
    await save(repo, CREW_C, 'alert', `${DAY}T08:00:00.000Z`); // now, oldest
    await save(repo, CREW_A, 'attention', `${DAY}T07:00:00.000Z`); // soon, oldest

    const queue = await listAlerts(repo);

    expect(queue.map((alert) => [alert.crewId, alert.urgency, alert.createdAt])).toEqual([
      [CREW_C, 'now', `${DAY}T08:00:00.000Z`],
      [CREW_B, 'now', `${DAY}T09:00:00.000Z`],
      [CREW_A, 'soon', `${DAY}T07:00:00.000Z`],
      [CREW_A, 'soon', `${DAY}T10:00:00.000Z`],
    ]);
  });

  it('lists only open alerts', async () => {
    const repo = new InMemoryCheckRepository();
    const id = await saveWithAlert(repo, CREW_A, 'alert', `${DAY}T08:00:00.000Z`);
    await saveWithAlert(repo, CREW_B, 'attention', `${DAY}T09:00:00.000Z`);
    await decideAlert(repo, new FixedClock(`${DAY}T09:30:00.000Z`), id, 'manage_on_base');

    const queue = await listAlerts(repo);

    expect(queue.map((alert) => alert.crewId)).toEqual([CREW_B]);
  });

  it('returns an empty queue when no check opened an alert', async () => {
    const repo = new InMemoryCheckRepository();
    await save(repo, CREW_A, 'ok', `${DAY}T08:00:00.000Z`);

    expect(await listAlerts(repo)).toEqual([]);
  });
});

describe('decideAlert', () => {
  it('records the decision with the clock instant and removes the alert from the queue', async () => {
    const repo = new InMemoryCheckRepository();
    const id = await saveWithAlert(repo, CREW_A, 'alert', `${DAY}T08:00:00.000Z`);
    const clock = new FixedClock(`${DAY}T08:15:00.000Z`);

    const result = await decideAlert(repo, clock, id, 'consult_surgeon');

    expect(result).toEqual({
      status: 'decided',
      alert: {
        id,
        urgency: 'now',
        status: 'decided',
        decision: 'consult_surgeon',
        decidedAt: `${DAY}T08:15:00.000Z`,
      },
    });
    expect(await listAlerts(repo)).toEqual([]);
  });

  it('answers already_decided on a second decision and keeps the first one', async () => {
    const repo = new InMemoryCheckRepository();
    const id = await saveWithAlert(repo, CREW_A, 'alert', `${DAY}T08:00:00.000Z`);
    await decideAlert(repo, new FixedClock(`${DAY}T08:15:00.000Z`), id, 'manage_on_base');

    const second = await decideAlert(
      repo,
      new FixedClock(`${DAY}T08:20:00.000Z`),
      id,
      'prepare_return',
    );

    expect(second).toEqual({ status: 'already_decided' });
    const stored = await repo.getLatestCheck(CREW_A);
    expect(stored?.alert).toMatchObject({
      decision: 'manage_on_base',
      decidedAt: `${DAY}T08:15:00.000Z`,
    });
  });

  it('answers not_found for an unknown alert id', async () => {
    const repo = new InMemoryCheckRepository();

    const result = await decideAlert(
      repo,
      new FixedClock(`${DAY}T08:00:00.000Z`),
      randomUUID(),
      'manage_on_base',
    );

    expect(result).toEqual({ status: 'not_found' });
  });

  it('answers invalid_decision without touching the repository or the clock', async () => {
    const repo = new InMemoryCheckRepository();
    const id = await saveWithAlert(repo, CREW_A, 'alert', `${DAY}T08:00:00.000Z`);
    const decideSpy = vi.spyOn(repo, 'decideAlert');
    const clock = new FixedClock(`${DAY}T08:15:00.000Z`);
    const nowSpy = vi.spyOn(clock, 'nowIso');

    const result = await decideAlert(repo, clock, id, 'x');

    expect(result).toEqual({ status: 'invalid_decision' });
    expect(decideSpy).not.toHaveBeenCalled();
    expect(nowSpy).not.toHaveBeenCalled();
    expect(await listAlerts(repo)).toHaveLength(1);
  });

  it('rejects non-string decisions as invalid', async () => {
    const repo: CheckRepository = new InMemoryCheckRepository();
    const decideSpy = vi.spyOn(repo, 'decideAlert');

    const result = await decideAlert(repo, new FixedClock(`${DAY}T08:00:00.000Z`), randomUUID(), 42);

    expect(result).toEqual({ status: 'invalid_decision' });
    expect(decideSpy).not.toHaveBeenCalled();
  });
});
