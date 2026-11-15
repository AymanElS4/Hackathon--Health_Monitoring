import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/adapters/http/configure-app';
import { FakeDatabaseProbe } from '../../src/adapters/memory/fake-database-probe';
import { FixedClock } from '../../src/adapters/memory/fixed-clock';
import { InMemoryCheckRepository } from '../../src/adapters/memory/in-memory-check-repository';
import { API_PREFIX } from '../../src/config/constants';
import { type Env } from '../../src/config/env';
import { CHECK_REPOSITORY } from '../../src/application/ports/check-repository.port';
import { CLOCK } from '../../src/application/ports/clock.port';
import { DATABASE_PROBE } from '../../src/application/ports/database-probe.port';
import { SyncCheck } from '../../src/domain/sync-check';
import { toStoredCheck } from '../../src/domain/to-stored-check';
import type { Verdict } from '../../src/shared/contracts';
import { validSyncCheck } from '../fixtures/sync-check.builder';

// The pool is lazy and never queried: the database probe is overridden with the fake below,
// and the check repository is overridden with the in-memory adapter.
const testEnv: Env = {
  databaseUrl: 'postgres://x:y@127.0.0.1:1/z',
  port: 0,
  surgeonAccessCode: 'surgeon-code-123',
  syncCode: 'sync-code-456789',
  corsOrigins: ['https://base-vital.pages.dev'],
};

const SURGEON_CREW_PATH = `/${API_PREFIX}/surgeon/crew`;
const crewDetailPath = (crewId: string): string => `${SURGEON_CREW_PATH}/${crewId}`;
const CREW_A = 'crew-aaaaaa';
const CREW_B = 'crew-bbbbbb';
const CREW_C = 'crew-cccccc';
const CREW_DETAIL = 'crew-a1b2c3';
const UNKNOWN_CREW = 'crew-zzzzzz';
const MALFORMED_CREW = 'x';
const MISSION_DAY = 23;
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_UNAVAILABLE = 503;
const NO_STORE = 'no-store';
const INVALID_CODE = { error: 'invalid_code' };
const NOT_FOUND = { error: 'not_found' };
const SURGEON_ALERTS_PATH = `/${API_PREFIX}/surgeon/alerts`;
const alertDecisionPath = (alertId: string): string => `${SURGEON_ALERTS_PATH}/${alertId}/decision`;
const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
const DECISION_AT = '2026-11-15T10:30:00.000Z';
const ALERT_CREATED_AT = '2026-11-15T09:00:00.000Z';
const NON_UUID_ID = 'abc';

/** Repository whose reads always fail, to simulate an unreachable database. */
class FailingReadRepository extends InMemoryCheckRepository {
  override async listCrewLatest(): Promise<never> {
    throw new Error('connection refused');
  }
}

type Harness = {
  app: INestApplication;
  repo: InMemoryCheckRepository;
  clock: FixedClock;
};

/** Builds a fresh app per test so failed-attempt counts never leak between tests. */
async function createHarness(repo: InMemoryCheckRepository = new InMemoryCheckRepository()): Promise<Harness> {
  const clock = new FixedClock(DECISION_AT);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(testEnv)] })
    .overrideProvider(DATABASE_PROBE)
    .useValue(new FakeDatabaseProbe())
    .overrideProvider(CHECK_REPOSITORY)
    .useValue(repo)
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, repo, clock };
}

/** Stores one valid check through the repository, exactly as the ingest path maps it. */
async function seedCheck(
  repo: InMemoryCheckRepository,
  crewId: string,
  completedAt: string,
  verdict: Verdict,
  missionDay = MISSION_DAY,
  alertCreatedAt = completedAt,
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
  // The in-memory repository stamps alert `createdAt` with `now()`; pin it for the queue order.
  repo.now = () => alertCreatedAt;
  await repo.saveCheck(check, alert);
}

describe('surgeon API (e2e)', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(async () => {
    await harness.app.close();
  });

  const server = () => harness.app.getHttpServer();

  describe('access control', () => {
    it('answers 401 invalid_code with no crew data when X-Access-Code is wrong', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'ok');

      const list = await request(server()).get(SURGEON_CREW_PATH).set('X-Access-Code', 'wrong-code-000');
      const detail = await request(server())
        .get(crewDetailPath(CREW_A))
        .set('X-Access-Code', 'wrong-code-000');

      for (const response of [list, detail]) {
        expect(response.status).toBe(HTTP_UNAUTHORIZED);
        expect(response.body).toEqual(INVALID_CODE);
        expect(response.text).not.toContain(CREW_A);
      }
    });

    it('answers 401 invalid_code when X-Access-Code is missing', async () => {
      const response = await request(server()).get(SURGEON_CREW_PATH);

      expect(response.status).toBe(HTTP_UNAUTHORIZED);
      expect(response.body).toEqual(INVALID_CODE);
    });

    it('answers 401 when the sync code is used as the access code', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'ok');

      const response = await request(server()).get(SURGEON_CREW_PATH).set('X-Access-Code', testEnv.syncCode);

      expect(response.status).toBe(HTTP_UNAUTHORIZED);
      expect(response.body).toEqual(INVALID_CODE);
      expect(response.text).not.toContain(CREW_A);
    });
  });

  describe('GET /surgeon/crew', () => {
    it('lists the latest check per crew: alert first, then attention, then ok', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'ok');
      await seedCheck(harness.repo, CREW_B, '2026-11-15T07:00:00.000Z', 'alert');
      await seedCheck(harness.repo, CREW_C, '2026-11-15T09:00:00.000Z', 'attention');

      const response = await request(server())
        .get(SURGEON_CREW_PATH)
        .set('X-Access-Code', testEnv.surgeonAccessCode);

      expect(response.status).toBe(HTTP_OK);
      expect(response.headers['cache-control']).toBe(NO_STORE);
      expect(response.body).toEqual([
        {
          crewId: CREW_B,
          missionDay: MISSION_DAY,
          completedAt: '2026-11-15T07:00:00.000Z',
          verdict: 'alert',
          actionKey: 'action.alert',
          simulated: false,
          openAlert: { id: expect.any(String), urgency: 'now' },
        },
        {
          crewId: CREW_C,
          missionDay: MISSION_DAY,
          completedAt: '2026-11-15T09:00:00.000Z',
          verdict: 'attention',
          actionKey: 'action.attention',
          simulated: false,
          openAlert: { id: expect.any(String), urgency: 'soon' },
        },
        {
          crewId: CREW_A,
          missionDay: MISSION_DAY,
          completedAt: '2026-11-15T08:00:00.000Z',
          verdict: 'ok',
          actionKey: null,
          simulated: false,
          openAlert: null,
        },
      ]);
    });

    it('answers 200 with an empty list when there are no checks', async () => {
      const response = await request(server())
        .get(SURGEON_CREW_PATH)
        .set('X-Access-Code', testEnv.surgeonAccessCode);

      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toEqual([]);
    });

    it('answers 503 database_unavailable when the repository read fails', async () => {
      await harness.app.close();
      harness = await createHarness(new FailingReadRepository());

      const response = await request(server())
        .get(SURGEON_CREW_PATH)
        .set('X-Access-Code', testEnv.surgeonAccessCode);

      expect(response.status).toBe(HTTP_UNAVAILABLE);
      expect(response.body).toEqual({ error: 'database_unavailable' });
    });
  });

  describe('GET /surgeon/crew/:crewId', () => {
    it('returns the latest check and the 14-day history, newest first, with full check details', async () => {
      await seedCheck(harness.repo, CREW_DETAIL, '2026-11-15T08:00:00.000Z', 'attention');
      await seedCheck(harness.repo, CREW_DETAIL, '2026-11-14T08:00:00.000Z', 'ok', MISSION_DAY - 1);
      await seedCheck(harness.repo, CREW_DETAIL, '2026-11-02T09:00:00.000Z', 'ok', MISSION_DAY - 13);
      // Outside the window: 14 days ending 2026-11-15 start on 2026-11-02.
      await seedCheck(harness.repo, CREW_DETAIL, '2026-11-01T09:00:00.000Z', 'ok', MISSION_DAY - 14);

      const response = await request(server())
        .get(crewDetailPath(CREW_DETAIL))
        .set('X-Access-Code', testEnv.surgeonAccessCode);

      expect(response.status).toBe(HTTP_OK);
      expect(response.headers['cache-control']).toBe(NO_STORE);
      expect(response.body.crewId).toBe(CREW_DETAIL);
      expect(response.body.missionStartDate).toBe('2026-10-24');
      expect(response.body.history.map((check: { completedAt: string }) => check.completedAt)).toEqual([
        '2026-11-15T08:00:00.000Z',
        '2026-11-14T08:00:00.000Z',
        '2026-11-02T09:00:00.000Z',
      ]);
      expect(response.body.latest).toEqual(response.body.history[0]);

      const latest = response.body.latest;
      expect(latest).toMatchObject({
        missionDay: MISSION_DAY,
        verdict: 'attention',
        actionKey: 'action.attention',
        symptoms: ['none'],
        simulated: false,
        alert: { status: 'open', decision: null, decidedAt: null, urgency: 'soon' },
      });
      expect(latest.readings.sleep).toMatchObject({ sensor: 'sleep', level: 'green' });
      expect(latest.observations).toHaveLength(6);
      expect(latest.observations).toContainEqual({
        indicator: 'blood_pressure',
        value: { systolic: 118, diastolic: 76 },
        unit: 'mmHg',
        source: 'device',
        confirmed: true,
        simulated: true,
      });
      expect(latest.observations).toContainEqual({
        indicator: 'mood',
        value: 4,
        unit: '1-5',
        source: 'voice',
        confirmed: true,
        simulated: false,
      });
    });

    it('answers 404 not_found for an unknown crew', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'ok');

      const response = await request(server())
        .get(crewDetailPath(UNKNOWN_CREW))
        .set('X-Access-Code', testEnv.surgeonAccessCode);

      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body).toEqual(NOT_FOUND);
    });

    it('answers 404 not_found for a malformed crew id without querying the repository', async () => {
      const getCrew = vi.spyOn(harness.repo, 'getCrew');

      const response = await request(server())
        .get(crewDetailPath(MALFORMED_CREW))
        .set('X-Access-Code', testEnv.surgeonAccessCode);

      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body).toEqual(NOT_FOUND);
      expect(getCrew).not.toHaveBeenCalled();
    });
  });

  describe('alerts queue', () => {
    it('lists open alerts with `now` before `soon`, then oldest first', async () => {
      await seedCheck(harness.repo, CREW_B, '2026-11-15T07:00:00.000Z', 'attention', MISSION_DAY, '2026-11-15T07:00:00.000Z');
      await seedCheck(harness.repo, CREW_C, '2026-11-15T08:00:00.000Z', 'attention', MISSION_DAY, '2026-11-15T08:00:00.000Z');
      await seedCheck(harness.repo, CREW_A, '2026-11-15T09:00:00.000Z', 'alert', MISSION_DAY, '2026-11-15T09:00:00.000Z');
      await seedCheck(harness.repo, CREW_DETAIL, '2026-11-15T06:00:00.000Z', 'ok');

      const response = await request(server()).get(SURGEON_ALERTS_PATH).set('X-Access-Code', testEnv.surgeonAccessCode);

      expect(response.status).toBe(HTTP_OK);
      expect(response.headers['cache-control']).toBe(NO_STORE);
      expect(response.body).toEqual([
        {
          id: expect.any(String),
          crewId: CREW_A,
          checkId: expect.any(String),
          missionDay: MISSION_DAY,
          verdict: 'alert',
          urgency: 'now',
          createdAt: '2026-11-15T09:00:00.000Z',
        },
        {
          id: expect.any(String),
          crewId: CREW_B,
          checkId: expect.any(String),
          missionDay: MISSION_DAY,
          verdict: 'attention',
          urgency: 'soon',
          createdAt: '2026-11-15T07:00:00.000Z',
        },
        {
          id: expect.any(String),
          crewId: CREW_C,
          checkId: expect.any(String),
          missionDay: MISSION_DAY,
          verdict: 'attention',
          urgency: 'soon',
          createdAt: '2026-11-15T08:00:00.000Z',
        },
      ]);
    });

    it('answers 200 with an empty list when every check is ok', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'ok');

      const response = await request(server()).get(SURGEON_ALERTS_PATH).set('X-Access-Code', testEnv.surgeonAccessCode);

      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toEqual([]);
    });

    it('answers 401 invalid_code for the alert list without a valid access code', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'alert');

      const missing = await request(server()).get(SURGEON_ALERTS_PATH);
      const wrong = await request(server()).get(SURGEON_ALERTS_PATH).set('X-Access-Code', testEnv.syncCode);

      for (const response of [missing, wrong]) {
        expect(response.status).toBe(HTTP_UNAUTHORIZED);
        expect(response.body).toEqual(INVALID_CODE);
        expect(response.text).not.toContain(CREW_A);
      }
    });

    it('answers 401 invalid_code for a decision without a valid access code', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'alert');
      const [alert] = await harness.repo.listOpenAlerts();

      const missing = await request(server())
        .post(alertDecisionPath(alert.id))
        .send({ decision: 'manage_on_base' });
      const wrong = await request(server())
        .post(alertDecisionPath(alert.id))
        .set('X-Access-Code', testEnv.syncCode)
        .send({ decision: 'manage_on_base' });

      for (const response of [missing, wrong]) {
        expect(response.status).toBe(HTTP_UNAUTHORIZED);
        expect(response.body).toEqual(INVALID_CODE);
      }
      expect(await harness.repo.listOpenAlerts()).toHaveLength(1);
    });

    it('records a decision stamped with the clock, removes it from the queue and shows it on the crew detail', async () => {
      await seedCheck(harness.repo, CREW_DETAIL, '2026-11-15T08:00:00.000Z', 'alert', MISSION_DAY, ALERT_CREATED_AT);
      const [alert] = await harness.repo.listOpenAlerts();

      const decide = await request(server())
        .post(alertDecisionPath(alert.id))
        .set('X-Access-Code', testEnv.surgeonAccessCode)
        .send({ decision: 'consult_surgeon' });

      expect(decide.status).toBe(HTTP_OK);
      expect(decide.headers['cache-control']).toBe(NO_STORE);
      expect(decide.body).toEqual({
        id: alert.id,
        status: 'decided',
        decision: 'consult_surgeon',
        decidedAt: DECISION_AT,
      });

      const queue = await request(server()).get(SURGEON_ALERTS_PATH).set('X-Access-Code', testEnv.surgeonAccessCode);
      expect(queue.status).toBe(HTTP_OK);
      expect(queue.body).toEqual([]);

      const detail = await request(server())
        .get(crewDetailPath(CREW_DETAIL))
        .set('X-Access-Code', testEnv.surgeonAccessCode);
      expect(detail.status).toBe(HTTP_OK);
      expect(detail.body.latest.alert).toEqual({
        id: alert.id,
        urgency: 'now',
        status: 'decided',
        decision: 'consult_surgeon',
        decidedAt: DECISION_AT,
      });
      expect(detail.body.history[0].alert).toEqual(detail.body.latest.alert);
    });

    it('answers 409 already_decided when the same alert is decided twice', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'attention');
      const [alert] = await harness.repo.listOpenAlerts();
      await request(server())
        .post(alertDecisionPath(alert.id))
        .set('X-Access-Code', testEnv.surgeonAccessCode)
        .send({ decision: 'manage_on_base' });

      const response = await request(server())
        .post(alertDecisionPath(alert.id))
        .set('X-Access-Code', testEnv.surgeonAccessCode)
        .send({ decision: 'prepare_return' });

      expect(response.status).toBe(HTTP_CONFLICT);
      expect(response.body).toEqual({ error: 'already_decided' });
    });

    it('answers 404 not_found for an unknown uuid', async () => {
      const response = await request(server())
        .post(alertDecisionPath(randomUUID()))
        .set('X-Access-Code', testEnv.surgeonAccessCode)
        .send({ decision: 'manage_on_base' });

      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body).toEqual(NOT_FOUND);
    });

    it('answers 404 not_found for a non-uuid alert id', async () => {
      const response = await request(server())
        .post(alertDecisionPath(NON_UUID_ID))
        .set('X-Access-Code', testEnv.surgeonAccessCode)
        .send({ decision: 'manage_on_base' });

      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body).toEqual(NOT_FOUND);
    });

    it('answers 400 invalid_decision for an unknown decision and keeps the alert open', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'alert');
      const [alert] = await harness.repo.listOpenAlerts();

      const response = await request(server())
        .post(alertDecisionPath(alert.id))
        .set('X-Access-Code', testEnv.surgeonAccessCode)
        .send({ decision: 'x' });

      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body).toEqual({ error: 'invalid_decision' });
      expect(await harness.repo.listOpenAlerts()).toHaveLength(1);
    });

    it('answers 400 invalid_decision when the body has no decision', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'alert');
      const [alert] = await harness.repo.listOpenAlerts();

      const response = await request(server())
        .post(alertDecisionPath(alert.id))
        .set('X-Access-Code', testEnv.surgeonAccessCode)
        .send({});

      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body).toEqual({ error: 'invalid_decision' });
    });

    it('answers 400 for malformed JSON without a decision', async () => {
      await seedCheck(harness.repo, CREW_A, '2026-11-15T08:00:00.000Z', 'alert');
      const [alert] = await harness.repo.listOpenAlerts();

      const response = await request(server())
        .post(alertDecisionPath(alert.id))
        .set('X-Access-Code', testEnv.surgeonAccessCode)
        .set('Content-Type', 'application/json')
        .send('{"decision":');

      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(await harness.repo.listOpenAlerts()).toHaveLength(1);
    });
  });
});
