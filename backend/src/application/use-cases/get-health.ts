import type { DatabaseProbe } from '../ports/database-probe.port';

const SERVICE_STATUS_OK = 'ok' as const;

/** Result of the health check: the service is up, and the database is either up or down. */
export type HealthReport = { status: 'ok'; database: 'up' | 'down' };

/**
 * Reports whether the database is reachable. Never throws: a probe that rejects
 * is treated as the database being down.
 */
export async function getHealth(probe: DatabaseProbe): Promise<HealthReport> {
  let reachable = false;
  try {
    reachable = await probe.isReachable();
  } catch {
    reachable = false;
  }
  return { status: SERVICE_STATUS_OK, database: reachable ? 'up' : 'down' };
}
