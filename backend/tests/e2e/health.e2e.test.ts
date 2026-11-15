import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/adapters/http/configure-app';
import { FakeDatabaseProbe } from '../../src/adapters/memory/fake-database-probe';
import { API_PREFIX } from '../../src/config/constants';
import { type Env } from '../../src/config/env';
import { DATABASE_PROBE } from '../../src/application/ports/database-probe.port';

// The pool is lazy and never queried: the probe is overridden with the fake below.
const testEnv: Env = {
  databaseUrl: 'postgres://x:y@127.0.0.1:1/z',
  port: 0,
  surgeonAccessCode: 'surgeon-code-123',
  syncCode: 'sync-code-456789',
  corsOrigins: ['https://base-vital.pages.dev'],
};

const HEALTH_PATH = `/${API_PREFIX}/health`;

describe('GET /api/v1/health (e2e)', () => {
  const probe = new FakeDatabaseProbe();
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(testEnv)] })
      .overrideProvider(DATABASE_PROBE)
      .useValue(probe)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with database up when the probe is reachable', async () => {
    probe.reachable = true;
    probe.failWith = null;

    const response = await request(app.getHttpServer()).get(HEALTH_PATH);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns 503 with database down when the probe is not reachable', async () => {
    probe.reachable = false;
    probe.failWith = null;

    const response = await request(app.getHttpServer()).get(HEALTH_PATH);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'ok', database: 'down' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns 503 with database down when the probe throws', async () => {
    probe.reachable = true;
    probe.failWith = new Error('connection refused');

    const response = await request(app.getHttpServer()).get(HEALTH_PATH);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'ok', database: 'down' });
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
