/** `withTimeout` bounds the startup seed (SEED_TIMEOUT_MS): it resolves with the work or rejects on time. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTimeout } from '../../src/application/use-cases/withTimeout';

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('resolves with the work when it settles before the limit', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it('rejects when the work has not settled after the limit', async () => {
    vi.useFakeTimers();
    const never = new Promise<number>(() => undefined);
    const result = withTimeout(never, 1000);
    const assertion = expect(result).rejects.toThrow('timed out after 1000 ms');
    vi.advanceTimersByTime(1000);
    await assertion;
  });
});
