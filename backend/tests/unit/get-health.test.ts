import { describe, expect, it } from 'vitest';
import { FakeDatabaseProbe } from '../../src/adapters/memory/fake-database-probe';
import { getHealth } from '../../src/application/use-cases/get-health';

describe('getHealth', () => {
  it('reports database up when the probe is reachable', async () => {
    const probe = new FakeDatabaseProbe();
    probe.reachable = true;

    await expect(getHealth(probe)).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('reports database down when the probe is not reachable', async () => {
    const probe = new FakeDatabaseProbe();
    probe.reachable = false;

    await expect(getHealth(probe)).resolves.toEqual({ status: 'ok', database: 'down' });
  });

  it('reports database down instead of throwing when the probe rejects', async () => {
    const probe = new FakeDatabaseProbe();
    probe.failWith = new Error('connection refused');

    await expect(getHealth(probe)).resolves.toEqual({ status: 'ok', database: 'down' });
  });
});
