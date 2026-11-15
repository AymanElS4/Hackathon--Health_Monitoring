import { randomUUID } from 'node:crypto';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgCheckRepository } from '../../src/adapters/postgres/pg-check-repository';
import { runMigrations } from '../../src/adapters/postgres/migrator';
import { MIGRATIONS_DIR } from '../../src/config/constants';
import { SyncCheck } from '../../src/domain/sync-check';
import { toStoredCheck } from '../../src/domain/to-stored-check';
import type { CheckToStore } from '../../src/domain/stored-check';
import { CREW_ID, validSyncCheck } from '../fixtures/sync-check.builder';

// Runs only against a real Postgres: set DATABASE_URL (see vitest.config.ts).
// Mirrors tests/unit/in-memory-check-repository.test.ts scenario by scenario.
const OTHER_CREW_ID = 'crew-d4e5f6';
const ACTION_KEY = 'action.red';
const DAY_ONE_COMPLETED_AT = '2026-11-15T08:00:00.000Z';
const DAY_TWO_COMPLETED_AT = '2026-11-16T08:00:00.000Z';
const DAY_TWO_MISSION_DAY = 24;
const DAY_THREE_COMPLETED_AT = '2026-11-17T08:00:00.000Z';
const DAY_THREE_MISSION_DAY = 25;
const WINDOW_FROM = '2026-11-15T00:00:00.000Z';
const WINDOW_TO = '2026-11-16T00:00:00.000Z';
const FIXED_NOW = '2026-11-15T09:30:00.000Z';
const LATER_DECISION = '2026-11-15T10:00:00.000Z';
const CHANGED_START_DATE = '2030-01-01';
const UNKNOWN_CREW_ID = 'crew-000000';
const MISSING_ALERT_ID = '00000000-0000-4000-8000-000000000000';
const CONCURRENT_SAVES = 5;
const SCHEMA_ID_LENGTH = 12;
const SCHEMA_PREFIX = 'it_';
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CLIENT_ID_A = '6f1c9a2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const CLIENT_ID_B = '7a2d0b3f-4c5e-4f60-9b7c-8d9e0f1a2b3c';
const CLIENT_ID_CONCURRENT = 'aa0e3d6c-7f8b-4c93-8e0f-1a2b3c4d5e6f';

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

describe.skipIf(!process.env.DATABASE_URL)('PgCheckRepository (integration)', () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const schema = `${SCHEMA_PREFIX}${randomUUID().replace(/-/g, '').slice(0, SCHEMA_ID_LENGTH)}`;
  let admin: Client;
  let pool: Pool;
  let repo: PgCheckRepository;

  beforeAll(async () => {
    admin = new Client({ connectionString: databaseUrl });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    // Every pooled connection resolves unqualified names inside the throwaway schema.
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    await runMigrations(pool, MIGRATIONS_DIR, () => undefined);
    repo = new PgCheckRepository(pool);
  });

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  });

  describe('saveCheck', () => {
    it('creates a check and returns its id', async () => {
      const { check, alert } = stored({ clientCheckId: CLIENT_ID_A });
      const result = await repo.saveCheck(check, alert);

      expect(result.status).toBe('created');
      const latest = await repo.getLatestCheck(CREW_ID);
      expect(latest?.id).toBe(result.id);
      expect(await repo.listChecks(CREW_ID, WINDOW_FROM, WINDOW_TO)).toHaveLength(1);
    });

    it('answers a duplicate clientCheckId with the existing id and writes nothing', async () => {
      const first = stored({ clientCheckId: CLIENT_ID_B });
      const created = await repo.saveCheck(first.check, first.alert);
      const again = await repo.saveCheck(first.check, first.alert);

      expect(again).toEqual({ status: 'duplicate', id: created.id });
      expect(await repo.listChecks(CREW_ID, WINDOW_FROM, WINDOW_TO)).toHaveLength(2);
    });

    it('creates exactly one check when saved concurrently with the same clientCheckId', async () => {
      const concurrent = stored({ clientCheckId: CLIENT_ID_CONCURRENT, verdict: 'attention', completedAt: DAY_THREE_COMPLETED_AT, missionDay: DAY_THREE_MISSION_DAY });
      const results = await Promise.all(
        Array.from({ length: CONCURRENT_SAVES }, () => repo.saveCheck(concurrent.check, concurrent.alert)),
      );

      const statuses = results.map((result) => result.status).sort();
      expect(statuses.filter((s) => s === 'created')).toHaveLength(1);
      expect(statuses.filter((s) => s === 'duplicate')).toHaveLength(CONCURRENT_SAVES - 1);
      const ids = new Set(results.map((result) => result.id));
      expect(ids.size).toBe(1);

      const rows = await pool.query<{ count: string }>(
        'SELECT count(*) AS count FROM check_records WHERE client_check_id = $1',
        [CLIENT_ID_CONCURRENT],
      );
      expect(Number(rows.rows[0]?.count)).toBe(1);
      const alerts = await pool.query<{ count: string }>(
        'SELECT count(*) AS count FROM alerts WHERE check_id = $1',
        [results[0]?.id],
      );
      expect(Number(alerts.rows[0]?.count)).toBe(1);
    });

    it('maps observations: blood pressure as a pair, numeric indicators as numbers', async () => {
      const crewCheck = stored({ clientCheckId: randomUUID(), crewId: OTHER_CREW_ID, completedAt: DAY_THREE_COMPLETED_AT, missionDay: DAY_THREE_MISSION_DAY });
      const { id } = await repo.saveCheck(crewCheck.check, crewCheck.alert);
      const view = await repo.getLatestCheck(OTHER_CREW_ID);

      expect(view?.id).toBe(id);
      const bp = view?.observations.find((o) => o.indicator === 'blood_pressure');
      const hr = view?.observations.find((o) => o.indicator === 'resting_heart_rate');
      expect(bp?.value).toEqual({ systolic: 118, diastolic: 76 });
      expect(hr?.value).toBe(62);
      expect(bp?.unit).toBe('mmHg');
      expect(view?.observations).toHaveLength(6);
    });

    it('opens an alert with status open for attention and alert, none for ok', async () => {
      const crew = 'crew-f1a2b3';
      const okCheck = stored({ clientCheckId: randomUUID(), crewId: crew });
      await repo.saveCheck(okCheck.check, okCheck.alert);
      expect((await repo.getLatestCheck(crew))?.alert).toBeNull();
      expect((await repo.listOpenAlerts()).filter((a) => a.crewId === crew)).toEqual([]);

      const attention = stored({
        clientCheckId: randomUUID(),
        crewId: crew,
        verdict: 'attention',
        completedAt: DAY_TWO_COMPLETED_AT,
        missionDay: DAY_TWO_MISSION_DAY,
      });
      await repo.saveCheck(attention.check, attention.alert);
      const latest = await repo.getLatestCheck(crew);
      expect(latest?.alert).toMatchObject({ urgency: 'soon', status: 'open', decision: null, decidedAt: null });

      const alertCheck = stored({
        clientCheckId: randomUUID(),
        crewId: crew,
        verdict: 'alert',
        completedAt: DAY_THREE_COMPLETED_AT,
        missionDay: DAY_THREE_MISSION_DAY,
      });
      await repo.saveCheck(alertCheck.check, alertCheck.alert);
      expect((await repo.getLatestCheck(crew))?.alert?.urgency).toBe('now');
      expect((await repo.listOpenAlerts()).filter((a) => a.crewId === crew)).toHaveLength(2);
    });

    it('keeps the first missionStartDate of a crew member', async () => {
      const crew = 'crew-c0ffee';
      const first = stored({ clientCheckId: randomUUID(), crewId: crew });
      await repo.saveCheck(first.check, first.alert);
      const later = stored({ clientCheckId: randomUUID(), crewId: crew, completedAt: DAY_TWO_COMPLETED_AT, missionDay: DAY_TWO_MISSION_DAY });
      const changed = { ...later.check, missionStartDate: CHANGED_START_DATE };
      await repo.saveCheck(changed, later.alert);

      expect(await repo.getCrew(crew)).toEqual({
        crewId: crew,
        missionStartDate: first.check.missionStartDate,
      });
      expect(await repo.getCrew(UNKNOWN_CREW_ID)).toBeNull();
    });
  });

  describe('reads', () => {
    it('listCrewLatest picks the newest check per crew', async () => {
      const crew = 'crew-1a1a1a';
      const newer = stored({ clientCheckId: randomUUID(), crewId: crew, completedAt: DAY_TWO_COMPLETED_AT, missionDay: DAY_TWO_MISSION_DAY, verdict: 'attention' });
      const older = stored({ clientCheckId: randomUUID(), crewId: crew, completedAt: DAY_ONE_COMPLETED_AT });
      await repo.saveCheck(newer.check, newer.alert);
      await repo.saveCheck(older.check, older.alert);
      const other = stored({ clientCheckId: randomUUID(), crewId: 'crew-2b2b2b' });
      await repo.saveCheck(other.check, other.alert);

      const latest = await repo.listCrewLatest();
      const mine = latest.find((row) => row.crewId === crew);
      expect(mine).toMatchObject({
        missionDay: DAY_TWO_MISSION_DAY,
        completedAt: DAY_TWO_COMPLETED_AT,
        verdict: 'attention',
        actionKey: ACTION_KEY,
        simulated: false,
        openAlert: { urgency: 'soon' },
      });
      expect(latest.find((row) => row.crewId === 'crew-2b2b2b')?.openAlert).toBeNull();
    });

    it('listChecks includes from, excludes to, and sorts newest first', async () => {
      const crew = 'crew-3c3c3c';
      const atFrom = stored({ clientCheckId: randomUUID(), crewId: crew, completedAt: WINDOW_FROM });
      const atTo = stored({ clientCheckId: randomUUID(), crewId: crew, completedAt: WINDOW_TO, missionDay: DAY_TWO_MISSION_DAY });
      const inside = stored({ clientCheckId: randomUUID(), crewId: crew, completedAt: '2026-11-15T12:00:00.000Z' });
      const before = stored({ clientCheckId: randomUUID(), crewId: crew, completedAt: '2026-11-14T23:59:59.000Z' });
      for (const row of [atFrom, atTo, inside, before]) {
        await repo.saveCheck(row.check, row.alert);
      }

      const checks = await repo.listChecks(crew, WINDOW_FROM, WINDOW_TO);
      expect(checks.map((c) => c.completedAt)).toEqual(['2026-11-15T12:00:00.000Z', WINDOW_FROM]);
      expect(await repo.listChecks(UNKNOWN_CREW_ID, WINDOW_FROM, WINDOW_TO)).toEqual([]);
    });

    it('returns fresh objects on every read', async () => {
      const crew = 'crew-4d4d4d';
      const { check, alert } = stored({ clientCheckId: randomUUID(), crewId: crew, verdict: 'attention' });
      await repo.saveCheck(check, alert);

      const view = await repo.getLatestCheck(crew);
      if (view?.alert) view.alert.status = 'decided';
      if (view) view.symptoms.push('dizziness');

      const again = await repo.getLatestCheck(crew);
      expect(again?.alert?.status).toBe('open');
      expect(again?.symptoms).toEqual(['none']);
    });
  });

  describe('decideAlert and listOpenAlerts', () => {
    it('transitions an open alert to decided and records the decision', async () => {
      const crew = 'crew-5e5e5e';
      const { check, alert } = stored({ clientCheckId: randomUUID(), crewId: crew, verdict: 'alert' });
      await repo.saveCheck(check, alert);
      const alertId = (await repo.getLatestCheck(crew))?.alert?.id ?? '';

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
      expect((await repo.listOpenAlerts()).some((a) => a.id === alertId)).toBe(false);
      expect((await repo.getLatestCheck(crew))?.alert?.status).toBe('decided');
      expect((await repo.listCrewLatest()).find((row) => row.crewId === crew)?.openAlert).toBeNull();
    });

    it('returns already_decided for a second decision and keeps the first one', async () => {
      const crew = 'crew-6f6f6f';
      const { check, alert } = stored({ clientCheckId: randomUUID(), crewId: crew, verdict: 'attention' });
      await repo.saveCheck(check, alert);
      const alertId = (await repo.getLatestCheck(crew))?.alert?.id ?? '';

      await repo.decideAlert(alertId, 'manage_on_base', FIXED_NOW);
      const second = await repo.decideAlert(alertId, 'prepare_return', LATER_DECISION);
      expect(second).toEqual({ status: 'already_decided' });
      expect((await repo.getLatestCheck(crew))?.alert?.decision).toBe('manage_on_base');
    });

    it('returns not_found for an unknown or non-uuid alert id', async () => {
      expect(await repo.decideAlert(MISSING_ALERT_ID, 'manage_on_base', FIXED_NOW)).toEqual({ status: 'not_found' });
      expect(await repo.decideAlert('missing-id', 'manage_on_base', FIXED_NOW)).toEqual({ status: 'not_found' });
    });

    it('lists open alerts with crew, check, mission day, verdict and creation time', async () => {
      const crew = 'crew-7a7a7a';
      const { check, alert } = stored({ clientCheckId: randomUUID(), crewId: crew, verdict: 'attention' });
      const saved = await repo.saveCheck(check, alert);
      const alertId = (await repo.getLatestCheck(crew))?.alert?.id;

      const open = (await repo.listOpenAlerts()).filter((a) => a.crewId === crew);
      expect(open).toHaveLength(1);
      expect(open[0]).toEqual({
        id: alertId,
        crewId: crew,
        checkId: saved.id,
        missionDay: check.missionDay,
        verdict: 'attention',
        urgency: 'soon',
        createdAt: expect.stringMatching(ISO_PATTERN),
      });
    });
  });
});
