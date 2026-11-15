import fs from 'node:fs';
import path from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { MIGRATION_LOCK_KEY } from '../../config/constants';

const MIGRATION_FILE_PATTERN = /^\d{4}_.+\.sql$/;
const SQL_EXTENSION = '.sql';

/** Sleep helper used between database probe attempts. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Applies every `NNNN_*.sql` file in `dir` that is not yet recorded in `schema_migrations`.
 * Files run in filename order, each in its own transaction. The whole run holds a Postgres
 * advisory lock so concurrent starts do not race. Returns the versions applied by this call.
 */
export async function runMigrations(
  pool: Pool,
  dir: string,
  log: (msg: string) => void = console.log,
): Promise<string[]> {
  const client: PoolClient = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const files = fs
      .readdirSync(dir)
      .filter((name) => MIGRATION_FILE_PATTERN.test(name))
      .sort();

    const recorded = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations',
    );
    const done = new Set(recorded.rows.map((row) => row.version));

    for (const file of files) {
      const version = file.slice(0, -SQL_EXTENSION.length);
      if (done.has(version)) {
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Migration ${file} failed: ${reason}`);
      }
      applied.push(version);
      log(`Applied migration ${version}`);
    }
    return applied;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    } finally {
      client.release();
    }
  }
}

/**
 * Runs `SELECT 1` until it succeeds. Throws the last error after `attempts` failed tries,
 * waiting `delayMs` between tries.
 */
export async function waitForDatabase(pool: Pool, attempts: number, delayMs: number): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }
      await delay(delayMs);
    }
  }
}
