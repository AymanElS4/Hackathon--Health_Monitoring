import { randomUUID } from 'node:crypto';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/adapters/postgres/migrator';
import { PgDatabaseProbe } from '../../src/adapters/postgres/pg-database-probe';
import { MIGRATIONS_DIR } from '../../src/config/constants';

// Runs only against a real Postgres: set DATABASE_URL (see vitest.config.ts).
const FIRST_VERSION = '0001_init';
const EXPECTED_TABLES = ['crew_members', 'check_records', 'observations', 'alerts'];
const SCHEMA_ID_LENGTH = 12;
const SCHEMA_PREFIX = 'it_';
const CREW_ID = 'crew-abc123';
const CREW_START_DATE = '2026-01-01';
const ACTION_CONSTRAINT = 'action_matches_verdict';
const VOICE_CONSTRAINT = 'voice_is_confirmed';

describe.skipIf(!process.env.DATABASE_URL)('database migrations (integration)', () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const schema = `${SCHEMA_PREFIX}${randomUUID().replace(/-/g, '').slice(0, SCHEMA_ID_LENGTH)}`;
  let admin: Client;
  let pool: Pool;

  beforeAll(async () => {
    admin = new Client({ connectionString: databaseUrl });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    // Every pooled connection resolves unqualified names inside the throwaway schema.
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  });

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  });

  it('applies 0001 on the first run and nothing on the second', async () => {
    const logs: string[] = [];
    const firstRun = await runMigrations(pool, MIGRATIONS_DIR, (msg) => logs.push(msg));
    const secondRun = await runMigrations(pool, MIGRATIONS_DIR, (msg) => logs.push(msg));

    expect(firstRun).toEqual([FIRST_VERSION]);
    expect(secondRun).toEqual([]);
    expect(logs).toEqual([`Applied migration ${FIRST_VERSION}`]);
  });

  it('creates the four domain tables in the schema', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
      [schema, EXPECTED_TABLES],
    );
    const names = result.rows.map((row) => row.table_name).sort();

    expect(names).toEqual([...EXPECTED_TABLES].sort());
  });

  it('rejects a check whose action_key contradicts its verdict', async () => {
    await pool.query('INSERT INTO crew_members (id, mission_start_date) VALUES ($1, $2)', [
      CREW_ID,
      CREW_START_DATE,
    ]);

    const insert = pool.query(
      `INSERT INTO check_records
         (client_check_id, crew_id, kind, mission_day, verdict, action_key, simulated, readings, completed_at)
       VALUES ($1, $2, 'daily', 1, 'ok', 'x', false, '{}'::jsonb, now())`,
      [randomUUID(), CREW_ID],
    );

    await expect(insert).rejects.toThrow(ACTION_CONSTRAINT);
  });

  it('rejects an unconfirmed voice observation', async () => {
    const check = await pool.query<{ id: string }>(
      `INSERT INTO check_records
         (client_check_id, crew_id, kind, mission_day, verdict, simulated, readings, completed_at)
       VALUES ($1, $2, 'daily', 1, 'ok', false, '{}'::jsonb, now())
       RETURNING id`,
      [randomUUID(), CREW_ID],
    );
    const checkId = check.rows[0]?.id;

    const insert = pool.query(
      `INSERT INTO observations
         (check_id, indicator, value_numeric, unit, source, confirmed, simulated, captured_at)
       VALUES ($1, 'mood', 3, '1-5', 'voice', false, false, now())`,
      [checkId],
    );

    await expect(insert).rejects.toThrow(VOICE_CONSTRAINT);
  });

  it('reports the database as reachable through PgDatabaseProbe', async () => {
    const probe = new PgDatabaseProbe(pool);

    await expect(probe.isReachable()).resolves.toBe(true);
  });
});
