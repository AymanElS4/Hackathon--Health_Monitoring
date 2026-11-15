import { describe, it, expect, vi, afterEach } from 'vitest';
import { FakeVoice } from '../../../src/adapters/fakes/FakeVoice';

// Test files are exempt from no-magic-numbers.
const LISTEN_TIMEOUT_MS = 5000;

describe('FakeVoice never_understands', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves null only once the listen timeout has elapsed', async () => {
    vi.useFakeTimers();
    const voice = new FakeVoice({ mode: 'never_understands' });
    let result: string | null | undefined;
    void voice.listen(['sí'], { timeoutMs: LISTEN_TIMEOUT_MS }).then((value) => {
      result = value;
    });

    await vi.advanceTimersByTimeAsync(LISTEN_TIMEOUT_MS - 1);
    expect(result).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBeNull();
  });
});
