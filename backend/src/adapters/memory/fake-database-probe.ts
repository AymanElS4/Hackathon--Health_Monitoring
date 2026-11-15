import type { DatabaseProbe } from '../../application/ports/database-probe.port';

/** In-memory test double for `DatabaseProbe`. Tests toggle `reachable` or set `failWith`. */
export class FakeDatabaseProbe implements DatabaseProbe {
  reachable = true;
  failWith: Error | null = null;

  async isReachable(): Promise<boolean> {
    if (this.failWith) {
      throw this.failWith;
    }
    return this.reachable;
  }
}
