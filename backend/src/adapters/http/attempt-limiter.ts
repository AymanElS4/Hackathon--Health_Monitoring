import { Injectable } from '@nestjs/common';
import { FAILED_ATTEMPTS_WINDOW_MS, MAX_FAILED_ATTEMPTS } from '../../config/constants';

/**
 * In-memory sliding-window counter of failed access-code attempts, keyed by client address.
 * A key is blocked when more than MAX_FAILED_ATTEMPTS failures fall inside the window.
 */
@Injectable()
export class AttemptLimiter {
  /** Clock source; tests replace it to drive the window deterministically. */
  public now: () => number = () => Date.now();

  private readonly failures = new Map<string, number[]>();

  isBlocked(key: string): boolean {
    const recent = this.pruneKey(key);
    return recent.length > MAX_FAILED_ATTEMPTS;
  }

  recordFailure(key: string): void {
    const now = this.now();
    this.pruneAll(now);
    const recent = this.pruneKey(key);
    recent.push(now);
    this.failures.set(key, recent);
  }

  /** Returns the failure timestamps for `key` that are still inside the window, dropping the rest. */
  private pruneKey(key: string): number[] {
    const now = this.now();
    const timestamps = this.failures.get(key) ?? [];
    const recent = timestamps.filter((at) => now - at < FAILED_ATTEMPTS_WINDOW_MS);
    if (recent.length === 0) {
      this.failures.delete(key);
    } else {
      this.failures.set(key, recent);
    }
    return recent;
  }

  /** Caps memory by removing every key whose failures have all left the window. */
  private pruneAll(now: number): void {
    for (const [key, timestamps] of this.failures) {
      const newest = timestamps[timestamps.length - 1];
      if (newest === undefined || now - newest >= FAILED_ATTEMPTS_WINDOW_MS) {
        this.failures.delete(key);
      }
    }
  }
}
