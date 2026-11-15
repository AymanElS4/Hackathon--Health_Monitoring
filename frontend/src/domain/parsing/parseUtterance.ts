/**
 * Deterministic parsing of a recognised utterance for one check-in step (T046, 006 T003).
 *
 * Pure and deterministic: no I/O, no AI, no config imports.
 * - Supports two voice languages, Spanish ('es', default) and English ('en'). Each language has
 *   its own word table (WORDS): mood phrases, symptom phrases, none/confirm/deny words, control
 *   words and a number parser (parseSpanishNumber or parseEnglishNumber). Nothing is shared
 *   between tables, so a word of one language is never understood in the other.
 * - Returns RAW values. Range checks (sleep > 16, mood outside 1-5) belong to the reducer.
 * - Control words are recognised at every step and win over any other reading of the same
 *   utterance ("para"/"stop", "sigue"/"continue", "repite"/"repeat").
 * - Yes/no words are intents only at step 'confirm' ("sí"/"si"/"yes" and "no"/"nope").
 * - Matching is case-insensitive and accent-insensitive.
 */
import type { Symptom } from '@base-vital/contracts';
import { MOOD_MAX, MOOD_MIN } from '@base-vital/contracts';
import { parseEnglishNumber } from './englishNumbers';
import { parseSpanishNumber } from './spanishNumbers';

export type StepKind = 'sleep' | 'mood' | 'symptoms' | 'confirm' | 'none';

export type VoiceLanguage = 'es' | 'en';

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

const SLEEP_INDICATOR = 'sleep_hours';
const MOOD_INDICATOR = 'mood';

/** The words one language understands at each step kind. */
interface LanguageWords {
  readonly mood: PhraseTable<number>;
  readonly symptoms: PhraseTable<Symptom>;
  readonly none: readonly string[];
  readonly confirm: readonly string[];
  readonly deny: readonly string[];
  readonly control: PhraseTable<Intent>;
  /**
   * When true, a symptom phrase right after a `none` word is a denial ("no dizziness") and is
   * skipped. Only English uses it; Spanish reads "no tengo mareo" as dizziness, as before.
   */
  readonly skipNegatedSymptoms: boolean;
  /** Reads a number from the raw transcript; used for sleep hours and mood digits. */
  readonly parseNumber: (transcript: string) => number | null;
}

const WORDS: Record<VoiceLanguage, LanguageWords> = {
  es: {
    mood: [
      ['muy mal', MOOD_VERY_BAD],
      ['mal', MOOD_BAD],
      ['regular', MOOD_REGULAR],
      ['bien', MOOD_GOOD],
      ['muy bien', MOOD_VERY_GOOD],
    ],
    symptoms: [
      ['mareo', 'dizziness'],
      ['desmayo', 'fainting'],
      ['dolor de pecho', 'chest_pain'],
      ['falta de aire', 'shortness_of_breath'],
    ],
    none: ['no', 'ninguno'],
    confirm: ['si'],
    deny: ['no'],
    control: [
      ['para', 'pause'],
      ['sigue', 'resume'],
      ['repite', 'repeat'],
    ],
    skipNegatedSymptoms: false,
    parseNumber: parseSpanishNumber,
  },
  en: {
    mood: [
      ['very bad', MOOD_VERY_BAD],
      ['bad', MOOD_BAD],
      ['okay', MOOD_REGULAR],
      ['ok', MOOD_REGULAR],
      ['so so', MOOD_REGULAR],
      ['good', MOOD_GOOD],
      ['very good', MOOD_VERY_GOOD],
    ],
    symptoms: [
      ['dizziness', 'dizziness'],
      ['dizzy', 'dizziness'],
      ['fainting', 'fainting'],
      ['fainted', 'fainting'],
      ['chest pain', 'chest_pain'],
      ['shortness of breath', 'shortness_of_breath'],
      ['short of breath', 'shortness_of_breath'],
    ],
    none: ['no', 'none'],
    confirm: ['yes', 'yeah', 'yep'],
    deny: ['no', 'nope'],
    control: [
      ['stop', 'pause'],
      ['pause', 'pause'],
      ['continue', 'resume'],
      ['resume', 'resume'],
      ['repeat', 'repeat'],
    ],
    skipNegatedSymptoms: true,
    parseNumber: parseEnglishNumber,
  },
};

/** The words one language's parser reads, as phrases; read-only, for grammar consistency checks (006). */
export interface ParserWords {
  readonly mood: readonly string[];
  readonly symptoms: readonly string[];
  readonly none: readonly string[];
  readonly confirm: readonly string[];
  readonly deny: readonly string[];
  readonly control: readonly string[];
}

function phrasesOf<T>(table: PhraseTable<T>): readonly string[] {
  return Object.freeze(table.map(([phrase]) => phrase));
}

export const PARSER_WORDS: Readonly<Record<VoiceLanguage, ParserWords>> = Object.freeze({
  es: Object.freeze({
    mood: phrasesOf(WORDS.es.mood),
    symptoms: phrasesOf(WORDS.es.symptoms),
    none: Object.freeze([...WORDS.es.none]),
    confirm: Object.freeze([...WORDS.es.confirm]),
    deny: Object.freeze([...WORDS.es.deny]),
    control: phrasesOf(WORDS.es.control),
  }),
  en: Object.freeze({
    mood: phrasesOf(WORDS.en.mood),
    symptoms: phrasesOf(WORDS.en.symptoms),
    none: Object.freeze([...WORDS.en.none]),
    confirm: Object.freeze([...WORDS.en.confirm]),
    deny: Object.freeze([...WORDS.en.deny]),
    control: phrasesOf(WORDS.en.control),
  }),
});

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

/** A phrase found in the tokens: its value and the index of its first token. */
interface PhraseHit<T> {
  readonly value: T;
  readonly start: number;
}

/**
 * Scans `tokens` left to right and returns every phrase found, in order of appearance. At each
 * position the longest phrase wins, so "muy bien" never reads as "bien".
 */
function findPhraseHits<T>(tokens: readonly string[], table: PhraseTable<T>): PhraseHit<T>[] {
  const entries = table
    .map(([phrase, value]) => ({ words: phrase.split(WORD_SEPARATOR), value }))
    .sort((a, b) => b.words.length - a.words.length);
  const found: PhraseHit<T>[] = [];
  let position = 0;
  while (position < tokens.length) {
    const hit = entries.find((entry) => matchesAt(tokens, position, entry.words));
    if (hit) {
      found.push({ value: hit.value, start: position });
      position += hit.words.length;
    } else {
      position += 1;
    }
  }
  return found;
}

/** The values of every phrase found, in order of appearance. */
function findPhrases<T>(tokens: readonly string[], table: PhraseTable<T>): T[] {
  return findPhraseHits(tokens, table).map((hit) => hit.value);
}

/** Whole-word membership: true when any token equals one of `words`. */
function containsWord(tokens: readonly string[], words: readonly string[]): boolean {
  return tokens.some((token) => words.includes(token));
}

/** Control words are checked first, at every step. */
function parseControlIntent(tokens: readonly string[], words: LanguageWords): ParseResult | null {
  const [intent] = findPhrases(tokens, words.control);
  return intent === undefined ? null : { kind: 'intent', intent };
}

function parseMood(
  tokens: readonly string[],
  transcript: string,
  words: LanguageWords,
): ParseResult | null {
  const [word] = findPhrases(tokens, words.mood);
  if (word !== undefined) {
    return { kind: 'value', indicator: MOOD_INDICATOR, value: word };
  }
  const digit = words.parseNumber(transcript);
  return digit === null ? null : { kind: 'value', indicator: MOOD_INDICATOR, value: digit };
}

/** True when the token just before `start` is a none word ("no" / "none"). */
function isNegated(tokens: readonly string[], start: number, words: LanguageWords): boolean {
  return start > 0 && words.none.includes(tokens[start - 1] ?? '');
}

function parseSymptoms(tokens: readonly string[], words: LanguageWords): ParseResult | null {
  const symptoms = [
    ...new Set(
      findPhraseHits(tokens, words.symptoms)
        .filter((hit) => !(words.skipNegatedSymptoms && isNegated(tokens, hit.start, words)))
        .map((hit) => hit.value),
    ),
  ];
  if (symptoms.length > 0) {
    return { kind: 'symptoms', symptoms };
  }
  return containsWord(tokens, words.none) ? { kind: 'symptoms', symptoms: ['none'] } : null;
}

function parseConfirm(tokens: readonly string[], words: LanguageWords): ParseResult | null {
  if (containsWord(tokens, words.confirm)) {
    return { kind: 'intent', intent: 'confirm' };
  }
  if (containsWord(tokens, words.deny)) {
    return { kind: 'intent', intent: 'deny' };
  }
  return null;
}

function parseSleep(transcript: string, words: LanguageWords): ParseResult | null {
  const hours = words.parseNumber(transcript);
  return hours === null ? null : { kind: 'value', indicator: SLEEP_INDICATOR, value: hours };
}

/**
 * Parses `transcript` as the answer expected at `step` in `language`.
 * Returns null for empty or unrecognised input.
 */
export function parseUtterance(
  step: StepKind,
  transcript: string,
  language: VoiceLanguage = 'es',
): ParseResult | null {
  const tokens = tokenise(transcript);
  if (tokens.length === 0) {
    return null;
  }
  const words = WORDS[language];

  const control = parseControlIntent(tokens, words);
  if (control !== null) {
    return control;
  }

  switch (step) {
    case 'sleep':
      return parseSleep(transcript, words);
    case 'mood':
      return parseMood(tokens, transcript, words);
    case 'symptoms':
      return parseSymptoms(tokens, words);
    case 'confirm':
      return parseConfirm(tokens, words);
    case 'none':
      return null;
  }
}
