import { describe, it, expect } from 'vitest';
import { BaselineIndicator } from '@base-vital/contracts';
import { MIN_SD } from '../src';

describe('MIN_SD', () => {
  it('has a value > 0 for every BaselineIndicator (BP split into systolic/diastolic)', () => {
    const table = MIN_SD as unknown as Record<string, number>;
    for (const indicator of BaselineIndicator.options) {
      expect(table[indicator], `MIN_SD.${indicator}`).toBeGreaterThan(0);
    }
  });
});
