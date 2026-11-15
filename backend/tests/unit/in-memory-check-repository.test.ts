import { describe, expect, it } from 'vitest';
import { InMemoryCheckRepository } from '../../src/adapters/memory/in-memory-check-repository';
import { SyncCheck } from '../../src/domain/sync-check';
import { toStoredCheck } from '../../src/domain/to-stored-check';
import type { CheckToStore } from '../../src/domain/stored-check';
import { CREW_ID, validSyncCheck } from '../fixtures/sync-check.builder';

const OTHER_CREW_ID = 'crew-d4e5f6';
const ACTION_KEY = 'action.red';
const DAY_ONE_COMPLETED_AT = '2026-11-15T08:00:00.000Z';
const DAY_TWO_COMPLETED_AT = '2026-11-16T08:00:00.000Z';
const DAY_TWO_MISSION_DAY = 24;
const WINDOW_FROM = '2026-11-15T00:00:00.000Z';
const WINDOW_TO = '2026-11-16T00:00:00.000Z';
const FIXED_NOW = '2026-11-15T09:30:00.000Z';
const CLIENT_ID_A = '6f1c9a2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const CLIENT_ID_B = '7a2d0b3f-4c5e-4f60-9b7c-8d9e0f1a2b3c';
const CLIENT_ID_C = '8b3e1c4a-5d6f-4a71-8c8d-9e0f1a2b3c4d';
const CLIENT_ID_D = '9c4f2d5b-6e7a-4b82-9d9e-0f1a2b3c4d5e';

type Overrides = {
  clientCheckId?: string;
  crewId?: string;
  missionDay?: number;
  completedAt?: string;
  verdict?: 'ok' | 'attention' | 'alert';
  actionKey?: string;
};

/** Builds a valid stored check from the wire fixture, with the given fields overridden. */
function stored(overrides: Overrides = {}): { check: CheckToStore; alert: { urgency: 'soon' | 'now' } | null } {
  const raw = validSyncCheck();
  const completedAt = overrides.completedAt ?? raw.check.id;
  const verdict = overrides.verdict ?? 'ok';
  const envelope = {
    ...raw,
    clientCheckId: overrides.clientCheckId ?? raw.clientCheckId,
    crewId: overrides.crewId ?? raw.crewId,
    missionDay: overrides.missionDay ?? raw.missionDay,
    check: {
      ...raw.check,
      id: completedAt,
      verdict,
      actionKey: overrides.actionKey ?? (verdict === 'ok' ? '' : ACTION_KEY),
    },
  };
  const parsed = SyncCheck.safeParse(envelope);
  if (!parsed.success) throw new Error('fixture must be a valid SyncCheck');
  return toStoredCheck(parsed.data);
}

describe('InMemoryCheckRepository.saveCheck', () => {
  it('creates a check and returns its id', async () => {
    const repo = new InMemoryCheckRepository();
    const { check, alert } = stored();
    const result = await repo.saveCheck(check, alert);

    expect(result.status).toBe('created');
    const latest = await repo.getLatestCheck(CREW_ID);
    expect(latest?.id).toBe(result.id);
    expect(await repo.listChecks(CREW_ID, WINDOW_FROM, WINDOW_TO)).toHaveLength(1);
  });

  it('answers a duplicate clientCheckId with the existing id and writes nothing', async () => {
    const repo = new InMemoryCheckRepository();
    const first = stored();
    const created = await repo.saveCheck(first.check, first.alert);
    const again = await repo.saveCheck(first.check, first.alert);

    expect(again).toEqual({ status: 'duplicate', id: created.id });
    expect(await repo.listChecks(CREW_ID, WINDOW_FROM, WINDOW_TO)).toHaveLength(1);
  });

  it('maps observations: blood pressure as a pair, numeric indicators as numbers', async () => {
    const repo = new InMemoryCheckRepository();
    const { check, alert } = stored();
    const { id } = await repo.saveCheck(check, alert);
    const view = await repo.getLatestCheck(CREW_ID);

    expect(view?.id).toBe(id);
    const bp = view?.observations.find((o) => o.indicator === 'blood_pressure');
    const hr = view?.observations.find((o) => o.indicator === 'resting_heart_rate');
    expect(bp?.value).toEqual({ systolic: 118, diastolic: 76 });
    expect(hr?.value).toBe(62);
    expect(bp?.unit).toBe('mmHg');
  });

  it('opens an alert with status open for attention and alert, none for ok', async () => {
    const repo = new InMemoryCheckRepository();
    const okCheck = stored({ clientCheckId: CLIENT_ID_A });
    await repo.saveCheck(okCheck.check, okCheck.alert);
    expect((await repo.getLatestCheck(CREW_ID))?.alert).toBeNull();
    expect(await repo.listOpenAlerts()).toEqual([]);

    const attention = stored({
      clientCheckId: CLIENT_ID_B,
      verdict: 'attention',
      completedAt: DAY_TWO_COMPLETED_AT,
      missionDay: DAY_TWO_MISSION_DAY,
    });
    await repo.saveCheck(attention.check, attention.alert);
    const latest = await repo.getLatestCheck(CREW_ID);
    expect(latest?.alert).toMatchObject({ urgency: 'soon', status: 'open', decision: null, decidedAt: null });

    const alertCheck = stored({ clientCheckId: CLIENT_ID_C, verdict: 'alert', completedAt: '2026-11-17T08:00:00.000Z', missionDay: 25 });
    await repo.saveCheck(alertCheck.check, alertCheck.alert);
    expect((await repo.getLatestCheck(CREW_ID))?.alert?.urgency).toBe('now');
    expect(await repo.listOpenAlerts()).toHaveLength(2);
  });

  it('keeps the first missionStartDate of a crew member', async () => {
    const repo = new InMemoryCheckRepository();
    const first = stored({ clientCheckId: CLIENT_ID_A });
    await repo.saveCheck(first.check, first.alert);
    const later = stored({ clientCheckId: CLIENT_ID_B, completedAt: DAY_TWO_COMPLETED_AT, missionDay: DAY_TWO_MISSION_DAY });
    const changed = { ...later.check, missionStartDate: '2030-01-01' };
    await repo.saveCheck(changed, later.alert);

    expect(await repo.getCrew(CREW_ID)).toEqual({
      crewId: CREW_ID,
      missionStartDate: first.check.missionStartDate,
    });
    expect(await repo.getCrew('crew-000000')).toBeNull();
  });
});

describe('InMemoryCheckRepository reads', () => {
  it('listCrewLatest picks the newest check per crew', async () => {
    const repo = new InMemoryCheckRepository();
    const newer = stored({ clientCheckId: CLIENT_ID_B, completedAt: DAY_TWO_COMPLETED_AT, missionDay: DAY_TWO_MISSION_DAY, verdict: 'attention' });
    const older = stored({ clientCheckId: CLIENT_ID_A, completedAt: DAY_ONE_COMPLETED_AT });
    await repo.saveCheck(newer.check, newer.alert);
    await repo.saveCheck(older.check, older.alert);
    const other = stored({ clientCheckId: CLIENT_ID_C, crewId: OTHER_CREW_ID });
    await repo.saveCheck(other.check, other.alert);

    const latest = await repo.listCrewLatest();
    expect(latest).toHaveLength(2);
    const mine = latest.find((row) => row.crewId === CREW_ID);
    expect(mine).toMatchObject({
      missionDay: DAY_TWO_MISSION_DAY,
      completedAt: DAY_TWO_COMPLETED_AT,
      verdict: 'attention',
      actionKey: ACTION_KEY,
      simulated: false,
      openAlert: { urgency: 'soon' },
    });
    expect(latest.find((row) => row.crewId === OTHER_CREW_ID)?.openAlert).toBeNull();
  });

  it('listChecks includes from, excludes to, and sorts newest first', async () => {
    const repo = new InMemoryCheckRepository();
    const atFrom = stored({ clientCheckId: CLIENT_ID_A, completedAt: WINDOW_FROM });
    const atTo = stored({ clientCheckId: CLIENT_ID_B, completedAt: WINDOW_TO, missionDay: DAY_TWO_MISSION_DAY });
    const inside = stored({ clientCheckId: CLIENT_ID_C, completedAt: '2026-11-15T12:00:00.000Z' });
    const before = stored({ clientCheckId: CLIENT_ID_D, completedAt: '2026-11-14T23:59:59.000Z' });
    for (const row of [atFrom, atTo, inside, before]) {
      await repo.saveCheck(row.check, row.alert);
    }

    const checks = await repo.listChecks(CREW_ID, WINDOW_FROM, WINDOW_TO);
    expect(checks.map((c) => c.completedAt)).toEqual(['2026-11-15T12:00:00.000Z', WINDOW_FROM]);
    expect(await repo.listChecks(OTHER_CREW_ID, WINDOW_FROM, WINDOW_TO)).toEqual([]);
  });

  it('returns copies, so callers cannot mutate internal state', async () => {
    const repo = new InMemoryCheckRepository();
    const { check, alert } = stored({ verdict: 'attention' });
    await repo.saveCheck(check, alert);

    const view = await repo.getLatestCheck(CREW_ID);
    if (view?.alert) view.alert.status = 'decided';
    if (view) view.symptoms.push('dizziness');

    const again = await repo.getLatestCheck(CREW_ID);
    expect(again?.alert?.status).toBe('open');
    expect(again?.symptoms).toEqual(['none']);
  });
});

describe('InMemoryCheckRepository.decideAlert', () => {
  it('transitions an open alert to decided and records the decision', async () => {
    const repo = new InMemoryCheckRepository();
    repo.now = () => FIXED_NOW;
    const { check, alert } = stored({ verdict: 'alert' });
    await repo.saveCheck(check, alert);
    const alertId = (await repo.getLatestCheck(CREW_ID))?.alert?.id ?? '';

    const result = await repo.decideAlert(alertId, 'consult_surgeon', FIXED_NOW);
    expect(result).toEqual({
      status: 'decided',
      alert: {
        id: alertId,
        urgency: 'now',
        status: 'decided',
        decision: 'consult_surgeon',
        decidedAt: FIXED_NOW,
      },
    });
    expect(await repo.listOpenAlerts()).toEqual([]);
    expect((await repo.listCrewLatest())[0]?.openAlert).toBeNull();
  });

  it('returns already_decided for a second decision and keeps the first one', async () => {
    const repo = new InMemoryCheckRepository();
    const { check, alert } = stored({ verdict: 'attention' });
    await repo.saveCheck(check, alert);
    const alertId = (await repo.getLatestCheck(CREW_ID))?.alert?.id ?? '';

    await repo.decideAlert(alertId, 'manage_on_base', FIXED_NOW);
    const second = await repo.decideAlert(alertId, 'prepare_return', '2026-11-15T10:00:00.000Z');
    expect(second).toEqual({ status: 'already_decided' });
    expect((await repo.getLatestCheck(CREW_ID))?.alert?.decision).toBe('manage_on_base');
  });

  it('returns not_found for an unknown alert id', async () => {
    const repo = new InMemoryCheckRepository();
    expect(await repo.decideAlert('missing-id', 'manage_on_base', FIXED_NOW)).toEqual({ status: 'not_found' });
  });

  it('lists open alerts with crew, check, mission day, verdict and creation time', async () => {
    const repo = new InMemoryCheckRepository();
    repo.now = () => FIXED_NOW;
    const { check, alert } = stored({ verdict: 'attention' });
    const saved = await repo.saveCheck(check, alert);

    const open = await repo.listOpenAlerts();
    expect(open).toEqual([
      {
        id: (await repo.getLatestCheck(CREW_ID))?.alert?.id,
        crewId: CREW_ID,
        checkId: saved.id,
        missionDay: check.missionDay,
        verdict: 'attention',
        urgency: 'soon',
        createdAt: FIXED_NOW,
      },
    ]);
  });
});

describe('InMemoryCheckRepository parity with Postgres', () => {
  it('stores completedAt normalized to ISO 8601 UTC, as the timestamptz column does', async () => {
    const repo = new InMemoryCheckRepository();
    const { check, alert } = stored();
    await repo.saveCheck({ ...check, completedAt: '2026-11-15T08:00:00+00:00' }, alert);

    const latest = await repo.getLatestCheck(CREW_ID);
    expect(latest?.completedAt).toBe(DAY_ONE_COMPLETED_AT);
  });

  it('rounds numeric observation values to two decimals in the view', async () => {
    const repo = new InMemoryCheckRepository();
    const { check, alert } = stored();
    const withPrecision = {
      ...check,
      observations: check.observations.map((observation) =>
        observation.indicator === 'sleep_hours' ? { ...observation, numeric: 7.456 } : observation,
      ),
    };
    await repo.saveCheck(withPrecision, alert);

    const view = await repo.getLatestCheck(CREW_ID);
    const sleep = view?.observations.find((o) => o.indicator === 'sleep_hours');
    expect(sleep?.value).toBe(7.46);
  });
});
