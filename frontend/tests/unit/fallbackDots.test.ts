import { describe, it, expect } from 'vitest';
import { FALLBACK_DOTS } from '../../src/config/constants';
import { SensorKey } from '@base-vital/contracts';

describe('FALLBACK_DOTS', () => {
  it('has exactly the 5 SensorKey keys', () => {
    expect(Object.keys(FALLBACK_DOTS).sort()).toEqual([...SensorKey.options].sort());
    expect(Object.keys(FALLBACK_DOTS)).toHaveLength(5);
  });

  it('has x and y percentages in 0–100 for every sensor', () => {
    for (const key of SensorKey.options) {
      const dot = FALLBACK_DOTS[key];
      expect(dot.x).toBeGreaterThanOrEqual(0);
      expect(dot.x).toBeLessThanOrEqual(100);
      expect(dot.y).toBeGreaterThanOrEqual(0);
      expect(dot.y).toBeLessThanOrEqual(100);
    }
  });
});
