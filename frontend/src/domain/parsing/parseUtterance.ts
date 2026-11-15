/**
 * Deterministic parsing of a recognised utterance for one check-in step (T046).
 *
 * Pure and deterministic: no I/O, no AI, no config imports.
 * - Returns RAW values. Range checks (sleep > 16, mood outside 1-5) belong to the reducer.
 * - Control words ("para", "sigue", "repite") are recognised at every step and win over
 *   any other reading of the same utterance.
 * - "sí"/"si" and "no" are intents only at step 'confirm'.
 * - Matching is case-insensitive and accent-insensitive.
 */
import type { Symptom } from '@base-vital/contracts';
import { MOOD_MAX, MOOD_MIN } from '@base-vital/contracts';
import { parseSpanishNumber } from './spanishNumbers';

export type StepKind = 'sleep' | 'mood' | 'symptoms' | 'confirm' | 'none';

export type Intent = 'confirm' | 'deny' | 'pause' | 'resume' | 'repeat';

export type ParseResult =
  | { kind: 'value'; indicator: 'sleep_hours' | 'mood'; value: number }
  | { kind: 'symptoms'; symptoms: Symptom[] }
  | { kind: 'intent'; intent: Intent };

/** Mood bounds live in @base-vital/contracts; re-exported for the reducer's range check (RN4). */
export { MOOD_MAX, MOOD_MIN };

const WORD_SEPARATOR = ' ';
const DIACRITIC_MARKS = /\p{Mn}/gu;
const NON_WORD_CHARACTERS = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/;

/** Phrase-to-value table. Matching is by whole words, so "muy bien" is one phrase. */
type PhraseTable<T> = ReadonlyArray<readonly [phrase: string, value: T]>;

const MOOD_VERY_BAD = MOOD_MIN;
const MOOD_BAD = 2;
const MOOD_REGULAR = 3;
const MOOD_GOOD = 4;
const MOOD_VERY_GOOD = MOOD_MAX;

const MOOD_WORDS: PhraseTable<number> = [
  ['muy mal', MOOD_VERY_BAD],
  ['mal', MOOD_BAD],
  ['regular', MOOD_REGULAR],
  ['bien', MOOD_GOOD],
  ['muy bien', MOOD_VERY_GOOD],
];

const SYMPTOM_PHRASES: PhraseTable<Symptom> = [
  ['mareo', 'dizziness'],
  ['desmayo', 'fainting'],
  ['dolor de pecho', 'chest_pain'],
  ['falta de aire', 'shortness_of_breath'],
];

const NONE_WORDS = ['no', 'ninguno'];
const CONFIRM_WORDS = ['si'];
const DENY_WORDS = ['no'];

const CONTROL_WORDS: PhraseTable<Intent> = [
  ['para', 'pause'],
  ['sigue', 'resume'],
  ['repite', 'repeat'],
];

const SLEEP_INDICATOR = 'sleep_hours';
const MOOD_INDICATOR = 'mood';

/** Lower-cases, strips accents and punctuation, and splits into single-space-free words. */
function tokenise(transcript: string): string[] {
  return transcript
    .normalize('NFD')
    .replace(DIACRITIC_MARKS, '')
    .toLowerCase()
    .replace(NON_WORD_CHARACTERS, WORD_SEPARATOR)
    .split(WHITESPACE)
    .filter((word) => word.length > 0);
}

/** True when `phraseWords` occur in `tokens` starting at `start`. */
function matchesAt(
  tokens: readonly string[],
  start: number,
  phraseWords: readonly string[],
): boolean {
  return phraseWords.every((word, offset) => tokens[start + offset] === word);
}

/**
 * Scans `tokens` left to right and returns the values of every phrase found, in order
 * of appearance. At each position the longest phrase wins, so "muy bien" never reads as "bien".
 */
function findPhrases<T>(tokens: readonly string[], table: PhraseTable<T>): T[] {
  const entries = table
    .map(([phrase, value]) => ({ words: phrase.split(WORD_SEPARATOR), value }))
    .sort((a, b) => b.words.length - a.words.length);
  const found: T[] = [];
  let position = 0;
  while (position < tokens.length) {
    const hit = entries.find((entry) => matchesAt(tokens, position, entry.words));
    if (hit) {
      found.push(hit.value);
      position += hit.words.length;
    } else {
      position += 1;
    }
  }
  return found;
}

/** Whole-word membership: true when any token equals one of `words`. */
function containsWord(tokens: readonly string[], words: readonly string[]): boolean {
  return tokens.some((token) => words.includes(token));
}

/** Control words are checked first, at every step. */
function parseControlIntent(tokens: readonly string[]): ParseResult | null {
  const [intent] = findPhrases(tokens, CONTROL_WORDS);
  return intent === undefined ? null : { kind: 'intent', intent };
}

function parseMood(tokens: readonly string[], transcript: string): ParseResult | null {
  const [word] = findPhrases(tokens, MOOD_WORDS);
  if (word !== undefined) {
    return { kind: 'value', indicator: MOOD_INDICATOR, value: word };
  }
  const digit = parseSpanishNumber(transcript);
  return digit === null ? null : { kind: 'value', indicator: MOOD_INDICATOR, value: digit };
}

function parseSymptoms(tokens: readonly string[]): ParseResult | null {
  const symptoms = [...new Set(findPhrases(tokens, SYMPTOM_PHRASES))];
  if (symptoms.length > 0) {
    return { kind: 'symptoms', symptoms };
  }
  return containsWord(tokens, NONE_WORDS) ? { kind: 'symptoms', symptoms: ['none'] } : null;
}

function parseConfirm(tokens: readonly string[]): ParseResult | null {
  if (containsWord(tokens, CONFIRM_WORDS)) {
    return { kind: 'intent', intent: 'confirm' };
  }
  if (containsWord(tokens, DENY_WORDS)) {
    return { kind: 'intent', intent: 'deny' };
  }
  return null;
}

function parseSleep(transcript: string): ParseResult | null {
  const hours = parseSpanishNumber(transcript);
  return hours === null ? null : { kind: 'value', indicator: SLEEP_INDICATOR, value: hours };
}

/**
 * Parses `transcript` as the answer expected at `step`.
 * Returns null for empty or unrecognised input.
 */
export function parseUtterance(step: StepKind, transcript: string): ParseResult | null {
  const tokens = tokenise(transcript);
  if (tokens.length === 0) {
    return null;
  }

  const control = parseControlIntent(tokens);
  if (control !== null) {
    return control;
  }

  switch (step) {
    case 'sleep':
      return parseSleep(transcript);
    case 'mood':
      return parseMood(tokens, transcript);
    case 'symptoms':
      return parseSymptoms(tokens);
    case 'confirm':
      return parseConfirm(tokens);
    case 'none':
      return null;
  }
}
