import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDatabaseProbe } from '../../src/adapters/postgres/pg-database-probe';
import { DB_PROBE_TIMEOUT_MS } from '../../src/config/constants';

describe('PgDatabaseProbe', () => {
  let query: ReturnType<typeof vi.fn>;
  let probe: PgDatabaseProbe;

  beforeEach(() => {
    vi.useFakeTimers();
    query = vi.fn();
    probe = new PgDatabaseProbe({ query } as unknown as Pool);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when SELECT 1 resolves', async () => {
    query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    await expect(probe.isReachable()).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns false when SELECT 1 rejects', async () => {
    query.mockRejectedValue(new Error('connection refused'));

    await expect(probe.isReachable()).resolves.toBe(false);
  });

  it('returns false when SELECT 1 never resolves within the timeout', async () => {
    query.mockReturnValue(new Promise(() => undefined));

    const result = probe.isReachable();
    await vi.advanceTimersByTimeAsync(DB_PROBE_TIMEOUT_MS);

    await expect(result).resolves.toBe(false);
  });

  it('clears its timer once the query answers', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(probe.isReachable()).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
