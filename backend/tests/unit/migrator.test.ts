import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MIGRATION_LOCK_KEY } from '../../src/config/constants';
import { runMigrations, waitForDatabase } from '../../src/adapters/postgres/migrator';

const FIRST_VERSION = '0001_init';
const SECOND_VERSION = '0002_broken';
const FIRST_SQL = 'CREATE TABLE first (id int);';
const BROKEN_MARKER = 'BROKEN_STATEMENT';
const BROKEN_SQL = `CREATE TABLE second (id int); ${BROKEN_MARKER};`;
const SILENT_LOG = (): void => undefined;

interface FakeDb {
  pool: Pool;
  queries: string[];
  recorded: Set<string>;
  lockKeys: unknown[];
  released: { count: number };
}

/** Hand-written fake of the pg pool/client surface used by runMigrations. No real database. */
function createFakeDb(options: { recorded?: string[]; failOnMarker?: boolean } = {}): FakeDb {
  const queries: string[] = [];
  const recorded = new Set<string>(options.recorded ?? []);
  const lockKeys: unknown[] = [];
  const released = { count: 0 };

  const client = {
    query: async (sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> => {
      queries.push(sql);
      if (sql === 'SELECT pg_advisory_lock($1)' && params) {
        lockKeys.push(params[0]);
      }
      if (options.failOnMarker && sql.includes(BROKEN_MARKER)) {
        throw new Error('syntax error at BROKEN_STATEMENT');
      }
      if (sql.startsWith('SELECT version FROM schema_migrations')) {
        return { rows: [...recorded].map((version) => ({ version })) };
      }
      if (sql.startsWith('INSERT INTO schema_migrations') && params) {
        recorded.add(String(params[0]));
      }
      return { rows: [] };
    },
    release: (): void => {
      released.count += 1;
    },
  };

  const pool = {
    connect: async (): Promise<typeof client> => client,
  } as unknown as Pool;

  return { pool, queries, recorded, lockKeys, released };
}

describe('runMigrations', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrator-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('applies 0001 once when the schema_migrations table is empty', async () => {
    fs.writeFileSync(path.join(dir, `${FIRST_VERSION}.sql`), FIRST_SQL);
    fs.writeFileSync(path.join(dir, 'README.md'), 'not a migration');
    const db = createFakeDb();

    const applied = await runMigrations(db.pool, dir, SILENT_LOG);

    expect(applied).toEqual([FIRST_VERSION]);
    expect(db.recorded.has(FIRST_VERSION)).toBe(true);
    expect(db.queries).toContain(FIRST_SQL);
    expect(db.queries).toContain('BEGIN');
    expect(db.queries).toContain('COMMIT');
    expect(db.queries).toContain('SELECT pg_advisory_lock($1)');
    expect(db.queries.at(-1)).toBe('SELECT pg_advisory_unlock($1)');
    expect(db.released.count).toBe(1);
  });

  it('applies nothing when the version is already recorded', async () => {
    fs.writeFileSync(path.join(dir, `${FIRST_VERSION}.sql`), FIRST_SQL);
    const db = createFakeDb({ recorded: [FIRST_VERSION] });

    const applied = await runMigrations(db.pool, dir, SILENT_LOG);

    expect(applied).toEqual([]);
    expect(db.queries).not.toContain(FIRST_SQL);
    expect(db.queries).not.toContain('BEGIN');
    expect(db.queries).not.toContain('COMMIT');
    expect(db.released.count).toBe(1);
  });

  it('rolls back, names the failing file, and still unlocks when a migration fails', async () => {
    fs.writeFileSync(path.join(dir, `${FIRST_VERSION}.sql`), FIRST_SQL);
    fs.writeFileSync(path.join(dir, `${SECOND_VERSION}.sql`), BROKEN_SQL);
    const db = createFakeDb({ failOnMarker: true });

    const run = runMigrations(db.pool, dir, SILENT_LOG);

    await expect(run).rejects.toThrow(`${SECOND_VERSION}.sql`);
    expect(db.queries).toContain('ROLLBACK');
    // Only the first file (0001) commits; the failing 0002 is rolled back instead.
    expect(db.queries.filter((sql) => sql === 'COMMIT')).toHaveLength(1);
    expect(db.recorded.has(SECOND_VERSION)).toBe(false);
    expect(db.recorded.has(FIRST_VERSION)).toBe(true);
    expect(db.queries).toContain('SELECT pg_advisory_unlock($1)');
    expect(db.released.count).toBe(1);
  });

  it('takes the advisory lock with the configured key', async () => {
    const db = createFakeDb();

    await runMigrations(db.pool, dir, SILENT_LOG);

    expect(db.lockKeys).toEqual([MIGRATION_LOCK_KEY]);
  });
});

/** Fake pool whose `query` rejects the first `failures` calls, then resolves. */
function createFlakyPool(failures: number): { pool: Pool; calls: { count: number } } {
  const calls = { count: 0 };
  const pool = {
    query: async (sql: string): Promise<{ rows: unknown[] }> => {
      calls.count += 1;
      if (sql !== 'SELECT 1') {
        throw new Error(`unexpected query: ${sql}`);
      }
      if (calls.count <= failures) {
        throw new Error(`connection refused (attempt ${calls.count})`);
      }
      return { rows: [{ '?column?': 1 }] };
    },
  } as unknown as Pool;
  return { pool, calls };
}

describe('waitForDatabase', () => {
  it('succeeds on the second attempt after one failure', async () => {
    const { pool, calls } = createFlakyPool(1);

    await expect(waitForDatabase(pool, 3, 1)).resolves.toBeUndefined();
    expect(calls.count).toBe(2);
  });

  it('throws the last error after N failed attempts', async () => {
    const { pool, calls } = createFlakyPool(Number.POSITIVE_INFINITY);

    await expect(waitForDatabase(pool, 4, 1)).rejects.toThrow('connection refused (attempt 4)');
    expect(calls.count).toBe(4);
  });
});
