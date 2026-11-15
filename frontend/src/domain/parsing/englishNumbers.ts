/**
 * Parses a spoken or typed English number into a numeric value.
 *
 * Pure and deterministic: no I/O, no locale APIs, no AI.
 * - Number words "zero" … "nineteen" and "twenty" map to 0–20.
 * - "twenty" followed by "one" … "four" (or hyphenated "twenty-four") maps to 21–24.
 * - Digits ("5", "7.5") map to their numeric value. A comma is not a decimal separator.
 * - The first token that reads as a number is used; other words ("hours", "slept") are ignored.
 * - "and a half" or "and half" after the number adds HALF ("seven and a half" → 7.5, "seven and half" → 7.5).
 * - Matching is case-insensitive. Anything else returns null.
 */

const HALF = 0.5;

const DIGITS_PATTERN = /^\d+(?:\.\d+)?$/;
const TOKEN_SEPARATOR = /[\s-]+/;
const WORD_TENS = 'twenty';
const WORD_AND = 'and';
const WORD_A = 'a';
const WORD_HALF = 'half';
/** Token offsets counted from the token right after the number: "and", then "a" (optional), then "half". */
const AND_OFFSET = 0;
const A_OFFSET = 1;
const HALF_OFFSET = 2;

/** Single number words mapped to their values (the tens word "twenty" is included). */
const NUMBER_WORD_VALUES = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

/** Units that follow "twenty" to form 21–24. */
const UNITS_AFTER_TENS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
};

const NUMBER_WORDS: ReadonlyMap<string, number> = new Map(Object.entries(NUMBER_WORD_VALUES));
const UNIT_WORDS_AFTER_TENS: ReadonlyMap<string, number> = new Map(
  Object.entries(UNITS_AFTER_TENS),
);

/** A number read starting at some token index, and how many tokens it spans. */
interface NumberReading {
  readonly value: number;
  readonly length: number;
}

/** Lower-cases and trims surrounding whitespace. */
function normalise(text: string): string {
  return text.toLowerCase().trim();
}

/** Reads a digit string such as "5" or "7.5", otherwise null. */
function readDigits(token: string): number | null {
  if (DIGITS_PATTERN.test(token)) {
    return Number(token);
  }
  return null;
}

/** Reads a number starting at the given token: a digit string, a number word, or "twenty" plus a unit. */
function readNumberAt(tokens: readonly string[], index: number): NumberReading | null {
  const token = tokens[index];
  const digits = readDigits(token);
  if (digits !== null) {
    return { value: digits, length: 1 };
  }
  if (token === WORD_TENS) {
    const unit = UNIT_WORDS_AFTER_TENS.get(tokens[index + 1] ?? '');
    if (unit !== undefined) {
      return { value: NUMBER_WORD_VALUES.twenty + unit, length: 2 };
    }
  }
  const word = NUMBER_WORDS.get(token);
  return word === undefined ? null : { value: word, length: 1 };
}

/** True when "and half" or "and a half" follows the number ending before `afterNumber`. */
function hasHalfAfter(tokens: readonly string[], afterNumber: number): boolean {
  if (tokens[afterNumber + AND_OFFSET] !== WORD_AND) return false;
  if (tokens[afterNumber + A_OFFSET] === WORD_HALF) return true;
  return tokens[afterNumber + A_OFFSET] === WORD_A && tokens[afterNumber + HALF_OFFSET] === WORD_HALF;
}

export function parseEnglishNumber(text: string): number | null {
  const tokens = normalise(text).split(TOKEN_SEPARATOR);
  for (let index = 0; index < tokens.length; index += 1) {
    const reading = readNumberAt(tokens, index);
    if (reading !== null) {
      const afterNumber = index + reading.length;
      return hasHalfAfter(tokens, afterNumber) ? reading.value + HALF : reading.value;
    }
  }
  return null;
}
