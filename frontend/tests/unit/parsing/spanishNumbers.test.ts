/**
 * Tests for Spanish number parsing used by the spoken check-in (T040).
 *
 * Expected API (implemented by T045):
 *
 *   // frontend/src/domain/parsing/spanishNumbers.ts
 *   export function parseSpanishNumber(text: string): number | null;
 *
 * Contract:
 * - Words "cero" … "veinticuatro" map to 0–24.
 * - Digits ("5", "7.5", "7,5") map to their numeric value.
 * - Trailing unit words ("cinco horas") are ignored.
 * - "y media" adds 0.5 ("siete y media" → 7.5).
 * - Matching is case-insensitive and accent-insensitive ("Seis", "dieciséis" / "dieciseis").
 * - Anything that is not a recognised number returns null.
 */
import { describe, it, expect } from 'vitest';
import { parseSpanishNumber } from '../../../src/domain/parsing/spanishNumbers';

const WORDS_0_TO_24: ReadonlyArray<readonly [string, number]> = [
  ['cero', 0],
  ['uno', 1],
  ['dos', 2],
  ['tres', 3],
  ['cuatro', 4],
  ['cinco', 5],
  ['seis', 6],
  ['siete', 7],
  ['ocho', 8],
  ['nueve', 9],
  ['diez', 10],
  ['once', 11],
  ['doce', 12],
  ['trece', 13],
  ['catorce', 14],
  ['quince', 15],
  ['dieciséis', 16],
  ['diecisiete', 17],
  ['dieciocho', 18],
  ['diecinueve', 19],
  ['veinte', 20],
  ['veintiuno', 21],
  ['veintidós', 22],
  ['veintitrés', 23],
  ['veinticuatro', 24],
];

describe('parseSpanishNumber', () => {
  describe('number words 0–24', () => {
    it.each(WORDS_0_TO_24)('parses "%s" as %i', (word, value) => {
      expect(parseSpanishNumber(word)).toBe(value);
    });
  });

  describe('digits', () => {
    it('parses an integer digit string', () => {
      expect(parseSpanishNumber('5')).toBe(5);
    });

    it('parses a decimal with a dot', () => {
      expect(parseSpanishNumber('7.5')).toBe(7.5);
    });

    it('parses a decimal with a comma', () => {
      expect(parseSpanishNumber('7,5')).toBe(7.5);
    });
  });

  describe('units and fractions', () => {
    it('ignores a trailing unit word ("cinco horas" → 5)', () => {
      expect(parseSpanishNumber('cinco horas')).toBe(5);
    });

    it('parses "y media" as +0.5 ("siete y media" → 7.5)', () => {
      expect(parseSpanishNumber('siete y media')).toBe(7.5);
    });

    it('parses a two-digit word with a unit ("veinte horas" → 20)', () => {
      expect(parseSpanishNumber('veinte horas')).toBe(20);
    });

    it('reads the first number token after a leading non-number word ("dormí 20 horas" → 20)', () => {
      expect(parseSpanishNumber('dormí 20 horas')).toBe(20);
    });

    it('reads "y media" after a bracketed unknown token ("[unk] siete y media" → 7.5)', () => {
      expect(parseSpanishNumber('[unk] siete y media')).toBe(7.5);
    });

    it('reads the feminine "una" as 1 ("una hora" → 1)', () => {
      expect(parseSpanishNumber('una hora')).toBe(1);
    });
  });

  describe('normalisation', () => {
    it('is case-insensitive ("Seis" → 6)', () => {
      expect(parseSpanishNumber('Seis')).toBe(6);
    });

    it('accepts the accented and unaccented form ("dieciséis" / "dieciseis" → 16)', () => {
      expect(parseSpanishNumber('dieciséis')).toBe(16);
      expect(parseSpanishNumber('dieciseis')).toBe(16);
    });
  });

  describe('unrecognised input', () => {
    it('returns null for nonsense', () => {
      expect(parseSpanishNumber('asdfgh')).toBeNull();
    });
  });
});
