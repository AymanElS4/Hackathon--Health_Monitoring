import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/adapters/http/configure-app';
import { FakeDatabaseProbe } from '../../src/adapters/memory/fake-database-probe';
import { InMemoryCheckRepository } from '../../src/adapters/memory/in-memory-check-repository';
import { API_PREFIX, MAX_FAILED_ATTEMPTS } from '../../src/config/constants';
import { type Env } from '../../src/config/env';
import { CHECK_REPOSITORY, type CheckRepository } from '../../src/application/ports/check-repository.port';
import { DATABASE_PROBE } from '../../src/application/ports/database-probe.port';

// The pool is lazy and never queried: the database probe is overridden with the fake below,
// and the check repository is overridden with the in-memory adapter.
const testEnv: Env = {
  databaseUrl: 'postgres://x:y@127.0.0.1:1/z',
  port: 0,
  surgeonAccessCode: 'surgeon-code-123',
  syncCode: 'sync-code-456789',
  corsOrigins: ['https://base-vital.pages.dev'],
};

const CHECKS_PATH = `/${API_PREFIX}/checks`;
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const WRONG_CODE = 'not-the-code-000';
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY = 429;
const HTTP_UNAVAILABLE = 503;

/** Reads a JSON fixture from `tests/fixtures` as an untyped body. */
function readFixture(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8')) as Record<string, unknown>;
}

/** Repository whose writes always fail, to simulate an unreachable database. */
class FailingCheckRepository extends InMemoryCheckRepository {
  override async saveCheck(): Promise<never> {
    throw new Error('connection refused');
  }
}

type Harness = {
  app: INestApplication;
  repo: CheckRepository;
};

/**
 * Builds a fresh app per test. A fresh app owns a fresh `AttemptLimiter`, so failed-attempt
 * counts never leak between tests.
 */
async function createHarness(repo: CheckRepository = new InMemoryCheckRepository()): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(testEnv)] })
    .overrideProvider(DATABASE_PROBE)
    .useValue(new FakeDatabaseProbe())
    .overrideProvider(CHECK_REPOSITORY)
    .useValue(repo)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, repo };
}

describe('POST /api/v1/checks (e2e)', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(async () => {
    await harness.app.close();
  });

  /** Sends a JSON body; the `X-Sync-Code` header is sent only when `code` is given. */
  const send = (body: unknown, code?: string) => {
    const req = request(harness.app.getHttpServer()).post(CHECKS_PATH);
    if (code !== undefined) {
      req.set('X-Sync-Code', code);
    }
    return req.set('Content-Type', 'application/json').send(body as object);
  };

  it('creates a check on the first valid send with the correct code', async () => {
    const response = await send(readFixture('sync-check.ok.json'), testEnv.syncCode);

    expect(response.status).toBe(HTTP_CREATED);
    expect(response.body).toEqual({ status: 'created', id: expect.any(String) });
  });

  it('answers 200 duplicate with the same id when the same check is sent again', async () => {
    const body = readFixture('sync-check.ok.json');
    const first = await send(body, testEnv.syncCode);
    const second = await send(body, testEnv.syncCode);

    expect(second.status).toBe(HTTP_OK);
    expect(second.body).toEqual({ status: 'duplicate', id: first.body.id });
  });

  it('creates an alert for an alert check and stores one open alert', async () => {
    const response = await send(readFixture('sync-check.alert.json'), testEnv.syncCode);

    expect(response.status).toBe(HTTP_CREATED);
    const openAlerts = await harness.repo.listOpenAlerts();
    expect(openAlerts).toHaveLength(1);
    expect(openAlerts[0]?.verdict).toBe('alert');
  });

  it('rejects an invalid body with 400 invalid_check and issues', async () => {
    const response = await send({ ...readFixture('sync-check.ok.json'), kind: 'exit' }, testEnv.syncCode);

    expect(response.status).toBe(HTTP_BAD_REQUEST);
    expect(response.body.error).toBe('invalid_check');
    expect(Array.isArray(response.body.issues)).toBe(true);
    expect(response.body.issues.length).toBeGreaterThan(0);
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await request(harness.app.getHttpServer())
      .post(CHECKS_PATH)
      .set('X-Sync-Code', testEnv.syncCode)
      .set('Content-Type', 'application/json')
      .send('{"clientCheckId": ');

    expect(response.status).toBe(HTTP_BAD_REQUEST);
    expect(response.body).toEqual({ error: 'invalid_check', issues: [] });
  });

  it('answers 401 invalid_code when the sync code header is missing', async () => {
    const response = await send(readFixture('sync-check.ok.json'));

    expect(response.status).toBe(HTTP_UNAUTHORIZED);
    expect(response.body).toEqual({ error: 'invalid_code' });
  });

  it('answers 401 when the surgeon access code is used as the sync code', async () => {
    const response = await send(readFixture('sync-check.ok.json'), testEnv.surgeonAccessCode);

    expect(response.status).toBe(HTTP_UNAUTHORIZED);
    expect(response.body).toEqual({ error: 'invalid_code' });
  });

  it('answers 429 too_many_attempts on the 11th wrong code, and keeps refusing a correct code', async () => {
    const body = readFixture('sync-check.ok.json');

    for (let attempt = 0; attempt < MAX_FAILED_ATTEMPTS; attempt += 1) {
      const response = await send(body, WRONG_CODE);
      expect(response.status).toBe(HTTP_UNAUTHORIZED);
      expect(response.body).toEqual({ error: 'invalid_code' });
    }

    const eleventh = await send(body, WRONG_CODE);
    expect(eleventh.status).toBe(HTTP_TOO_MANY);
    expect(eleventh.body).toEqual({ error: 'too_many_attempts' });

    const correct = await send(body, testEnv.syncCode);
    expect(correct.status).toBe(HTTP_TOO_MANY);
    expect(correct.body).toEqual({ error: 'too_many_attempts' });
  });

  it('answers 503 database_unavailable when the repository write fails', async () => {
    await harness.app.close();
    harness = await createHarness(new FailingCheckRepository());

    const response = await send(readFixture('sync-check.ok.json'), testEnv.syncCode);

    expect(response.status).toBe(HTTP_UNAVAILABLE);
    expect(response.body).toEqual({ error: 'database_unavailable' });
  });
});
