import { describe, expect, it } from 'vitest';
import { InMemoryCheckRepository } from '../../src/adapters/memory/in-memory-check-repository';
import type { CheckRepository } from '../../src/application/ports/check-repository.port';
import { ingestCheck } from '../../src/application/use-cases/ingest-check';
import { CREW_ID, validSyncCheck } from '../fixtures/sync-check.builder';

const REPEAT_SENDS = 5;
const ONE_CHECK = 1;
const MAX_OPEN_ALERTS = 1;
const ALERT_ACTION_KEY = 'action.red';
const WINDOW_FROM = '2026-11-15T00:00:00.000Z';
const WINDOW_TO = '2026-11-16T00:00:00.000Z';

/** A wire envelope with verdict `alert`, a red pulse reading and the matching action key. */
function alertBody() {
  const body = structuredClone(validSyncCheck());
  body.check.verdict = 'alert';
  body.check.actionKey = ALERT_ACTION_KEY;
  body.check.readings.pulse = { ...body.check.readings.pulse, level: 'red' };
  return body;
}

describe('ingestCheck', () => {
  it('creates a valid check', async () => {
    const repo = new InMemoryCheckRepository();
    const result = await ingestCheck(repo, validSyncCheck());

    expect(result.status).toBe('created');
    if (result.status === 'invalid') return;
    const latest = await repo.getLatestCheck(CREW_ID);
    expect(latest?.id).toBe(result.id);
  });

  it('stores one check and at most one open alert when the same body is sent five times', async () => {
    const repo = new InMemoryCheckRepository();
    const body = alertBody();

    const results = [];
    for (let attempt = 0; attempt < REPEAT_SENDS; attempt += 1) {
      results.push(await ingestCheck(repo, body));
    }

    expect(results[0]?.status).toBe('created');
    const first = results[0];
    if (!first || first.status === 'invalid') throw new Error('first send must be created');
    for (const result of results.slice(1)) {
      expect(result).toEqual({ status: 'duplicate', id: first.id });
    }

    expect(await repo.listChecks(CREW_ID, WINDOW_FROM, WINDOW_TO)).toHaveLength(ONE_CHECK);
    const openAlerts = (await repo.listOpenAlerts()).filter((alert) => alert.crewId === CREW_ID);
    expect(openAlerts.length).toBeLessThanOrEqual(MAX_OPEN_ALERTS);
  });

  it('rejects an invalid body with issues and stores nothing', async () => {
    const repo = new InMemoryCheckRepository();
    const result = await ingestCheck(repo, {});

    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.issues.length).toBeGreaterThan(0);
    for (const issue of result.issues) {
      expect(Array.isArray(issue.path)).toBe(true);
      expect(typeof issue.message).toBe('string');
    }
    expect(await repo.listCrewLatest()).toEqual([]);
    expect(await repo.listOpenAlerts()).toEqual([]);
  });

  it('does not echo rejected input values in the issues', async () => {
    const repo = new InMemoryCheckRepository();
    const body = { ...validSyncCheck(), crewId: 'SECRET-VALUE-123' };
    const result = await ingestCheck(repo, body);

    expect(result.status).toBe('invalid');
    expect(JSON.stringify(result)).not.toContain('SECRET-VALUE-123');
  });

  it('does not echo received enum values or unknown keys in the issues', async () => {
    const repo = new InMemoryCheckRepository();
    const body = structuredClone(validSyncCheck()) as Record<string, unknown>;
    body.SECRET_KEY = 'x';
    (body.check as { observations: Record<string, unknown>[] }).observations[0] = {
      ...(body.check as { observations: Record<string, unknown>[] }).observations[0],
      source: 'SECRET-SRC',
    };
    const result = await ingestCheck(repo, body);

    expect(result.status).toBe('invalid');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('SECRET-SRC');
    expect(serialized).not.toContain('SECRET_KEY');
    expect(result.status === 'invalid' && result.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining(['value not allowed', 'unknown field']),
    );
  });

  it('propagates repository errors', async () => {
    const failing: CheckRepository = {
      saveCheck: async () => {
        throw new Error('connection refused');
      },
      listCrewLatest: async () => [],
      getCrew: async () => null,
      listChecks: async () => [],
      getLatestCheck: async () => null,
      listOpenAlerts: async () => [],
      decideAlert: async () => ({ status: 'not_found' }),
    };

    await expect(ingestCheck(failing, validSyncCheck())).rejects.toThrow('connection refused');
  });
});
