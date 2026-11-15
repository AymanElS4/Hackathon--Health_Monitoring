import { describe, it, expect } from 'vitest';
import { actionIsTeamCriterion } from '../../src/application/use-cases/checkinEvaluation';

describe('actionIsTeamCriterion (Principle VIII)', () => {
  it('is true only when the evaluation flags its action as a team criterion', () => {
    expect(actionIsTeamCriterion({ verdict: 'attention', actionKey: 'action.single_amber', actionTeamCriterion: true })).toBe(true);
  });

  it('is false when the flag is false or absent', () => {
    expect(actionIsTeamCriterion({ verdict: 'attention', actionKey: 'action.slept_little', actionTeamCriterion: false })).toBe(false);
    expect(actionIsTeamCriterion({ verdict: 'ok', actionKey: '' })).toBe(false);
  });
});
