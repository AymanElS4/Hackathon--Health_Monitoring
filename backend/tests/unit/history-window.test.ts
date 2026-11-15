import { describe, expect, it } from 'vitest';
import { historyWindow } from '../../src/domain/history-window';
import { HISTORY_DAYS } from '../../src/config/constants';

describe('historyWindow', () => {
  it('spans 14 calendar days ending on the latest check day', () => {
    expect(historyWindow('2026-11-15T08:00:00.000Z')).toEqual({
      from: '2026-11-02T00:00:00.000Z',
      to: '2026-11-16T00:00:00.000Z',
    });
  });

  it('uses HISTORY_DAYS by default', () => {
    expect(HISTORY_DAYS).toBe(14);
    expect(historyWindow('2026-11-15T08:00:00.000Z', HISTORY_DAYS)).toEqual(
      historyWindow('2026-11-15T08:00:00.000Z'),
    );
  });

  it('keeps the same day when the latest check is at 23:59:59.999Z', () => {
    expect(historyWindow('2026-11-15T23:59:59.999Z')).toEqual({
      from: '2026-11-02T00:00:00.000Z',
      to: '2026-11-16T00:00:00.000Z',
    });
  });

  it('starts the window at 00:00Z of the latest day', () => {
    expect(historyWindow('2026-11-15T00:00:00.000Z')).toEqual({
      from: '2026-11-02T00:00:00.000Z',
      to: '2026-11-16T00:00:00.000Z',
    });
  });

  it('crosses a month boundary', () => {
    expect(historyWindow('2026-12-03T12:00:00.000Z')).toEqual({
      from: '2026-11-20T00:00:00.000Z',
      to: '2026-12-04T00:00:00.000Z',
    });
  });

  it('crosses a year boundary', () => {
    expect(historyWindow('2027-01-05T10:00:00.000Z')).toEqual({
      from: '2026-12-23T00:00:00.000Z',
      to: '2027-01-06T00:00:00.000Z',
    });
  });

  it('accepts a custom day count', () => {
    expect(historyWindow('2026-11-15T08:00:00.000Z', 1)).toEqual({
      from: '2026-11-15T00:00:00.000Z',
      to: '2026-11-16T00:00:00.000Z',
    });
  });
});
