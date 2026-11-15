/**
 * Parses a spoken or typed Spanish number into a numeric value.
 *
 * Pure and deterministic: no I/O, no locale APIs, no AI.
 * - Number words "cero" … "veinticuatro" map to 0–24 (accent-insensitive).
 * - Digits ("5", "7.5", "7,5") map to their numeric value.
 * - The first token that reads as a number is used; other words ("dormí", "horas") are ignored.
 * - "y media" after the number adds HALF ("siete y media" → 7.5).
 * - Matching is case-insensitive. Anything else returns null.
 */

const HALF = 0.5;

const DIGITS_PATTERN = /^\d+(?:[.,]\d+)?$/;
const DECIMAL_SEPARATOR = /,/;
const DECIMAL_POINT = '.';
const WHITESPACE = /\s+/;
const DIACRITIC_MARKS = /\p{Mn}/gu;
const CONJUNCTION_Y = 'y';
const WORD_MEDIA = 'media';
/** Token offsets after the number word: "y" comes next, then "media". */
const CONJUNCTION_OFFSET = 1;
const MEDIA_OFFSET = 2;

/** Accent-free number words mapped to their values. */
const NUMBER_WORD_VALUES = {
  cero: 0,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
};

const NUMBER_WORDS: ReadonlyMap<string, number> = new Map(Object.entries(NUMBER_WORD_VALUES));

/** Lower-cases, strips diacritics and trims surrounding whitespace. */
function normalise(text: string): string {
  return text.normalize('NFD').replace(DIACRITIC_MARKS, '').toLowerCase().trim();
}

/** Reads the value of a single token: a number word or a digit string, otherwise null. */
function readToken(token: string): number | null {
  if (DIGITS_PATTERN.test(token)) {
    return Number(token.replace(DECIMAL_SEPARATOR, DECIMAL_POINT));
  }
  return NUMBER_WORDS.get(token) ?? null;
}

export function parseSpanishNumber(text: string): number | null {
  const tokens = normalise(text).split(WHITESPACE);
  for (let index = 0; index < tokens.length; index += 1) {
    const base = readToken(tokens[index]);
    if (base !== null) {
      const hasHalf =
        tokens[index + CONJUNCTION_OFFSET] === CONJUNCTION_Y &&
        tokens[index + MEDIA_OFFSET] === WORD_MEDIA;
      return hasHalf ? base + HALF : base;
    }
  }
  return null;
}
