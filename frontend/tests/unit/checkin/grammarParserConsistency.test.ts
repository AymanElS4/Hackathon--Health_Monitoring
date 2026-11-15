/**
 * Consistency between what the UI sends and what the listening grammars let through (006 review
 * finding 6). If a chip or a parser word is missing from its step grammar, Vosk never returns it
 * and the answer is lost. Tests may import both the config and the domain; the domain does not
 * import config.
 */
import { describe, it, expect } from 'vitest';
import { messages } from '../../../src/config/messages.es';
import { MESSAGES_EN } from '../../../src/config/messages.en';
import {
  CONFIRM_GRAMMAR,
  MOOD_GRAMMAR,
  NEXT_GRAMMAR,
  SLEEP_GRAMMAR,
  SYMPTOM_GRAMMAR,
} from '../../../src/config/checkinScripts';
import { PARSER_WORDS, type VoiceLanguage } from '../../../src/domain/parsing/parseUtterance';

const LANGUAGES: readonly VoiceLanguage[] = ['es', 'en'];

type Grammar = Readonly<Record<VoiceLanguage, readonly string[]>>;

/** Catalog text of `key` as the UI shows it in `language` (English falls back to Spanish, like t()). */
function chipText(language: VoiceLanguage, key: string): string {
  const text = language === 'en' ? (MESSAGES_EN[key] ?? messages[key]) : messages[key];
  if (text === undefined) throw new Error(`missing message key ${key}`);
  return text;
}

/** Lower-cased words of a text, split as the recogniser splits a transcript. */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length > 0);
}

/** Words of `phrases` (each may hold several words) that `grammar` does not list. */
function missingFrom(grammar: readonly string[], phrases: readonly string[]): string[] {
  return phrases.flatMap(wordsOf).filter((word) => !grammar.includes(word));
}

/** Keys of the symptom chips, from either catalog. */
const SYMPTOM_CHIP_KEYS = [...new Set([...Object.keys(messages), ...Object.keys(MESSAGES_EN)])]
  .filter((key) => key.startsWith('checkin.symptom.'))
  .sort();

describe('chip values the UI sends are in the step grammars', () => {
  it.each(LANGUAGES)('%s: yes and no chips are confirm words', (language) => {
    const chips = ['checkin.yes', 'checkin.no'].map((key) => chipText(language, key));
    expect(missingFrom(CONFIRM_GRAMMAR[language], chips)).toEqual([]);
  });

  it.each(LANGUAGES)('%s: the yes chip is a next-activity word', (language) => {
    expect(missingFrom(NEXT_GRAMMAR[language], [chipText(language, 'checkin.yes')])).toEqual([]);
  });

  it.each(LANGUAGES)('%s: every symptom chip is a symptoms word', (language) => {
    const chips = SYMPTOM_CHIP_KEYS.map((key) => chipText(language, key));
    expect(chips.length).toBeGreaterThan(0);
    expect(missingFrom(SYMPTOM_GRAMMAR[language], chips)).toEqual([]);
  });
});

describe('parser phrase words are in the matching step grammars', () => {
  it.each(LANGUAGES)('%s: mood phrases are mood words', (language) => {
    expect(missingFrom(MOOD_GRAMMAR[language], PARSER_WORDS[language].mood)).toEqual([]);
  });

  it.each(LANGUAGES)('%s: symptom phrases are symptoms words', (language) => {
    expect(missingFrom(SYMPTOM_GRAMMAR[language], PARSER_WORDS[language].symptoms)).toEqual([]);
  });

  it.each(LANGUAGES)('%s: none words are symptoms words', (language) => {
    expect(missingFrom(SYMPTOM_GRAMMAR[language], PARSER_WORDS[language].none)).toEqual([]);
  });

  it.each(LANGUAGES)('%s: confirm and deny words are confirm words', (language) => {
    const { confirm, deny } = PARSER_WORDS[language];
    expect(missingFrom(CONFIRM_GRAMMAR[language], [...confirm, ...deny])).toEqual([]);
  });

  it.each(LANGUAGES)('%s: control words are in every listening grammar', (language) => {
    const grammars: Grammar[] = [SLEEP_GRAMMAR, MOOD_GRAMMAR, SYMPTOM_GRAMMAR, CONFIRM_GRAMMAR, NEXT_GRAMMAR];
    for (const grammar of grammars) {
      expect(missingFrom(grammar[language], PARSER_WORDS[language].control)).toEqual([]);
    }
  });
});
