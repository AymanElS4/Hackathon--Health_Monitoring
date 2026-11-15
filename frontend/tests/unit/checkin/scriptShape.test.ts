/**
 * Type-level check that the real daily script is a valid `CheckinScript` (T048).
 * The annotation fails `tsc` if `config/checkinScripts.ts` drifts from the domain types.
 */
import { describe, it, expect } from 'vitest';
import { checkinScripts } from '../../../src/config/checkinScripts';
import type { CheckinScript } from '../../../src/domain/checkin/types';

describe('checkinScripts.daily', () => {
  it('type-checks as CheckinScript and keeps the step order', () => {
    const s: CheckinScript = checkinScripts.daily;
    expect(s.map((step) => step.id)).toEqual([
      'greeting',
      'ask_sleep',
      'confirm_sleep',
      'ask_mood',
      'confirm_mood',
      'ask_symptoms',
      'measuring',
      'summary',
      'next_activity',
    ]);
  });
});
