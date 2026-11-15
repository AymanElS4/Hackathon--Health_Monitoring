/**
 * Tests for the team-criterion note rule (T080, Principle VIII). A screen renders
 * `team.criterion.note` once when some element on it carries the "*" mark.
 */
import { describe, it, expect } from 'vitest';
import { needsTeamNote } from '../../src/ui/teamNote';

const plain = { level: 'green', teamCriterion: false } as const;
const marked = { level: 'amber', teamCriterion: true } as const;

describe('needsTeamNote', () => {
  it('is false when no element carries the mark', () => {
    expect(needsTeamNote({ readings: [plain, { level: 'unknown', teamCriterion: false }] })).toBe(false);
    expect(needsTeamNote({ readings: [], marks: [false] })).toBe(false);
  });

  it('is true for a non-green dot with teamCriterion (it shows a status label with "*")', () => {
    expect(needsTeamNote({ readings: [plain, marked] })).toBe(true);
  });

  it('is false for a green dot with teamCriterion, since a green dot has no status label to mark', () => {
    expect(needsTeamNote({ readings: [{ level: 'green', teamCriterion: true }] })).toBe(false);
  });

  it('is true when another marked element is on the screen (mood chip, verdict)', () => {
    expect(needsTeamNote({ readings: [], marks: [true] })).toBe(true);
    expect(needsTeamNote({ readings: [plain], marks: [false, true] })).toBe(true);
  });
});
