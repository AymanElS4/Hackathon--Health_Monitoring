import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_CONNECT_TIMEOUT_MS } from '../../config/constants';

/** Injection token for the shared Postgres pool. */
export const PG_POOL = Symbol('PG_POOL');

/** Creates the shared Postgres pool. Idle-client errors are logged, never thrown. */
export function createPool(databaseUrl: string): Pool {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
  });
  pool.on('error', (error: Error) => {
    console.error(`Postgres pool error: ${error.message}`);
  });
  return pool;
}

/** Ends the shared pool when the Nest application shuts down (enableShutdownHooks). */
@Injectable()
export class PoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
