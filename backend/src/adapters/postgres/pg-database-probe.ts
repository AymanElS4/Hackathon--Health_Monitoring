import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type { DatabaseProbe } from '../../application/ports/database-probe.port';
import { DB_PROBE_TIMEOUT_MS } from '../../config/constants';
import { PG_POOL } from './pool';

const PROBE_QUERY = 'SELECT 1';

/** Reports whether Postgres answers `SELECT 1` within `DB_PROBE_TIMEOUT_MS`. */
@Injectable()
export class PgDatabaseProbe implements DatabaseProbe {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async isReachable(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), DB_PROBE_TIMEOUT_MS);
    });
    const query = (async (): Promise<boolean> => {
      await this.pool.query(PROBE_QUERY);
      return true;
    })().catch(() => false);
    try {
      return await Promise.race([query, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
