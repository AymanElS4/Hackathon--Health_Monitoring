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

// The pool is lazy and never queried: the database probe is overridden with the fake below.
const testEnv: Env = {
  databaseUrl: 'postgres://x:y@127.0.0.1:1/z',
  port: 0,
  surgeonAccessCode: 'surgeon-code-123',
  syncCode: 'sync-code-456789',
  corsOrigins: ['https://base-vital.pages.dev'],
};

const PAGE_PATH = '/cirujano';
const ASSET_PATH = `${PAGE_PATH}/assets`;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; " +
  "base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const TEAM_CRITERION_TEXT = 'criterio del equipo, no clínico';
const UNKNOWN_ASSETS = [
  `${ASSET_PATH}/../package.json`,
  `${ASSET_PATH}/..%2Fpackage.json`,
  `${ASSET_PATH}/unknown.js`,
  `${ASSET_PATH}/cirujano.js.map`,
  `${ASSET_PATH}/`,
];

describe('surgeon page (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(testEnv)] })
      .overrideProvider(DATABASE_PROBE)
      .useValue(new FakeDatabaseProbe())
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /cirujano returns the HTML page with the security headers', async () => {
    const response = await request(app.getHttpServer()).get(PAGE_PATH);

    expect(response.status).toBe(HTTP_OK);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['content-security-policy']).toBe(CSP);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toContain('<html lang="es">');
    expect(response.text).toContain('/cirujano/assets/cirujano.js');
  });

  it('GET /cirujano/assets/messages.js exposes window.MESSAGES with the team criterion text', async () => {
    const response = await request(app.getHttpServer()).get(`${ASSET_PATH}/messages.js`);

    expect(response.status).toBe(HTTP_OK);
    expect(response.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(response.headers['content-security-policy']).toBe(CSP);
    expect(response.text).toContain('window.MESSAGES');
    expect(response.text).toContain(TEAM_CRITERION_TEXT);
  });

  it('GET /cirujano/assets/cirujano.js serves the script', async () => {
    const response = await request(app.getHttpServer()).get(`${ASSET_PATH}/cirujano.js`);

    expect(response.status).toBe(HTTP_OK);
    expect(response.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /cirujano/assets/cirujano.css serves the stylesheet', async () => {
    const response = await request(app.getHttpServer()).get(`${ASSET_PATH}/cirujano.css`);

    expect(response.status).toBe(HTTP_OK);
    expect(response.headers['content-type']).toBe('text/css; charset=utf-8');
    expect(response.headers['content-security-policy']).toBe(CSP);
  });

  it.each(UNKNOWN_ASSETS)('answers 404 for %s', async (url) => {
    const response = await request(app.getHttpServer()).get(url);

    expect(response.status).toBe(HTTP_NOT_FOUND);
    expect(response.text).not.toContain('@base-vital/backend');
  });

  it('keeps the API prefix for the API routes', async () => {
    const response = await request(app.getHttpServer()).get(`/${API_PREFIX}/health`);

    expect(response.status).toBe(HTTP_OK);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('does not serve the API without the prefix', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(HTTP_NOT_FOUND);
  });
});
