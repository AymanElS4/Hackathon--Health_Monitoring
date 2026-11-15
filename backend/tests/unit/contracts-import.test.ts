import { describe, expect, it } from 'vitest';
import { Verdict } from '../../src/shared/contracts';

describe('shared contracts re-export', () => {
  it('exposes the Verdict enum from libs/contracts', () => {
    expect(Verdict.options).toEqual(['ok', 'attention', 'alert']);
  });
});
