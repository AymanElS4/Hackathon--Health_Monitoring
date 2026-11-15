/**
 * Tests for `usePrefersReducedMotion` (T078, reduced motion): reads the media query and follows changes.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePrefersReducedMotion } from '../../src/ui/body3d/usePrefersReducedMotion';
import { REDUCED_MOTION_QUERY } from '../../src/config/constants';

interface FakeQuery {
  matches: boolean;
  listeners: Set<() => void>;
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
}

function stubMatchMedia(matches: boolean): FakeQuery {
  const query: FakeQuery = {
    matches,
    listeners: new Set(),
    addEventListener: (_type, cb) => query.listeners.add(cb),
    removeEventListener: (_type, cb) => query.listeners.delete(cb),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => {
      expect(media).toBe(REDUCED_MOTION_QUERY);
      return query as unknown as MediaQueryList;
    }),
  );
  return query;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('usePrefersReducedMotion', () => {
  it('is true when the user prefers reduced motion', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('is false when the user does not prefer reduced motion', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('follows a change of the preference', () => {
    const query = stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());

    act(() => {
      query.matches = true;
      for (const listener of query.listeners) listener();
    });
    expect(result.current).toBe(true);
  });

  it('is false without matchMedia (no crash in environments that lack it)', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
