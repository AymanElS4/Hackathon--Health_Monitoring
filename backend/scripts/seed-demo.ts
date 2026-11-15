import 'reflect-metadata';
import { createPool } from '../src/adapters/postgres/pool';
import { PgCheckRepository } from '../src/adapters/postgres/pg-check-repository';
import { runMigrations } from '../src/adapters/postgres/migrator';
import { MIGRATIONS_DIR } from '../src/config/constants';
import { ingestCheck, type IngestResult } from '../src/application/use-cases/ingest-check';
import { demoSyncChecks } from './demo-checks';

// Loads the simulated demo history (FR-016) into Postgres through the ingest use case.
// Idempotent: each check has a fixed clientCheckId, so a second run reports every check as duplicate.
// Usage: DATABASE_URL=postgres://... node dist/backend/scripts/seed-demo.js

const EXIT_FAILURE = 1;
const ENV_DATABASE_URL = 'DATABASE_URL';

type Status = IngestResult['status'];
const STATUSES: readonly Status[] = ['created', 'duplicate', 'invalid'];

async function main(): Promise<void> {
  const databaseUrl = process.env[ENV_DATABASE_URL];
  if (!databaseUrl) {
    console.error(`seed-demo: ${ENV_DATABASE_URL} is required (postgres://user:pass@host:port/db)`);
    process.exit(EXIT_FAILURE);
  }

  const pool = createPool(databaseUrl);
  const counts: Record<Status, number> = { created: 0, duplicate: 0, invalid: 0 };
  try {
    await runMigrations(pool, MIGRATIONS_DIR, (msg) => console.log(msg));
    const repo = new PgCheckRepository(pool);
    for (const body of demoSyncChecks()) {
      const result = await ingestCheck(repo, body);
      counts[result.status] += 1;
      if (result.status === 'invalid') {
        console.error(`invalid check: ${JSON.stringify(result.issues)}`);
      }
    }
  } finally {
    await pool.end();
  }

  const summary = STATUSES.map((status) => `${status}=${counts[status]}`).join(' ');
  console.log(`seed-demo: ${summary}`);
  if (counts.invalid > 0) {
    process.exit(EXIT_FAILURE);
  }
}

main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`seed-demo failed: ${reason}`);
  process.exit(EXIT_FAILURE);
});
