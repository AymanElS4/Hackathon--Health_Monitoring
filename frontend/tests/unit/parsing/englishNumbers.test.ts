/**
 * Tests for English number parsing used by the spoken check-in (006, T002).
 *
 * Expected API (implemented in T002):
 *
 *   // frontend/src/domain/parsing/englishNumbers.ts
 *   export function parseEnglishNumber(text: string): number | null;
 *
 * Contract:
 * - Words "zero" … "twenty four" map to 0–24.
 * - "twenty-four" (hyphen) and "twenty four" (two tokens) both map to 24.
 * - Digits ("5", "7.5") map to their numeric value.
 * - A comma is not a decimal separator in English: "7,5" is not a number.
 * - Trailing unit words ("seven hours") are ignored.
 * - "and a half" adds 0.5 ("seven and a half" → 7.5).
 * - Matching is case-insensitive. Anything that is not a recognised number returns null.
 */
import { describe, it, expect } from 'vitest';
import { parseEnglishNumber } from '../../../src/domain/parsing/englishNumbers';

const WORDS_0_TO_24: ReadonlyArray<readonly [string, number]> = [
  ['zero', 0],
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
  ['thirteen', 13],
  ['fourteen', 14],
  ['fifteen', 15],
  ['sixteen', 16],
  ['seventeen', 17],
  ['eighteen', 18],
  ['nineteen', 19],
  ['twenty', 20],
  ['twenty one', 21],
  ['twenty two', 22],
  ['twenty three', 23],
  ['twenty four', 24],
];

describe('parseEnglishNumber', () => {
  describe('number words 0–24', () => {
    it.each(WORDS_0_TO_24)('parses "%s" as %i', (word, value) => {
      expect(parseEnglishNumber(word)).toBe(value);
    });
  });

  describe('compound twenty-something', () => {
    it('parses a hyphenated "twenty-four" as 24', () => {
      expect(parseEnglishNumber('twenty-four')).toBe(24);
    });

    it('parses "twenty four" in two tokens as 24', () => {
      expect(parseEnglishNumber('twenty four')).toBe(24);
    });

    it('parses "twenty-one" as 21', () => {
      expect(parseEnglishNumber('twenty-one')).toBe(21);
    });
  });

  describe('digits', () => {
    it('parses an integer digit string', () => {
      expect(parseEnglishNumber('5')).toBe(5);
    });

    it('parses a decimal with a dot', () => {
      expect(parseEnglishNumber('7.5')).toBe(7.5);
    });

    it('does not treat a comma as a decimal separator ("7,5" → null)', () => {
      expect(parseEnglishNumber('7,5')).toBeNull();
    });
  });

  describe('units and fractions', () => {
    it('ignores a trailing unit word ("seven hours" → 7)', () => {
      expect(parseEnglishNumber('seven hours')).toBe(7);
    });

    it('parses "and a half" as +0.5 ("seven and a half" → 7.5)', () => {
      expect(parseEnglishNumber('seven and a half')).toBe(7.5);
    });

    it('parses "and half" without "a" as +0.5 ("seven and half" → 7.5)', () => {
      expect(parseEnglishNumber('seven and half')).toBe(7.5);
    });

    it('parses a compound number followed by "and a half" ("twenty four and a half" → 24.5)', () => {
      expect(parseEnglishNumber('twenty four and a half')).toBe(24.5);
    });

    it('parses a two-digit word with a unit ("twenty hours" → 20)', () => {
      expect(parseEnglishNumber('twenty hours')).toBe(20);
    });

    it('reads the first number token after a leading non-number word ("i slept 20 hours" → 20)', () => {
      expect(parseEnglishNumber('i slept 20 hours')).toBe(20);
    });

    it('reads "and a half" after a bracketed unknown token ("[unk] seven and a half" → 7.5)', () => {
      expect(parseEnglishNumber('[unk] seven and a half')).toBe(7.5);
    });

    it('does not add a half when "and a half" is absent ("seven and a" → 7)', () => {
      expect(parseEnglishNumber('seven and a')).toBe(7);
    });
  });

  describe('normalisation', () => {
    it('is case-insensitive ("Six" → 6)', () => {
      expect(parseEnglishNumber('Six')).toBe(6);
    });

    it('is case-insensitive for "And A Half" ("Seven And A Half" → 7.5)', () => {
      expect(parseEnglishNumber('Seven And A Half')).toBe(7.5);
    });
  });

  describe('unrecognised input', () => {
    it('returns null for nonsense', () => {
      expect(parseEnglishNumber('asdfgh')).toBeNull();
    });

    it('returns null for empty text', () => {
      expect(parseEnglishNumber('')).toBeNull();
    });
  });
});
