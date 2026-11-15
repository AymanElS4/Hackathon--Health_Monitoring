/**
 * Tests for English utterance parsing used by the spoken check-in (006, T003).
 *
 * Expected API (implemented by T003):
 *
 *   // frontend/src/domain/parsing/parseUtterance.ts
 *   export type VoiceLanguage = 'es' | 'en';
 *   export function parseUtterance(
 *     step: StepKind,
 *     transcript: string,
 *     language?: VoiceLanguage, // default 'es'
 *   ): ParseResult | null;
 *
 * Contract (English):
 * - Mood phrases: "very bad" 1, "bad" 2, "okay"/"ok"/"so so" 3, "good" 4, "very good" 5.
 * - Mood digits "one".."five" map to 1..5 via parseEnglishNumber.
 * - Symptoms: "dizziness"/"dizzy", "fainting"/"fainted", "chest pain",
 *   "shortness of breath"/"short of breath"; "none"/"no" at symptoms -> ['none'].
 * - Yes/no ("yes", "yeah", "yep" / "no", "nope") are intents only at step confirm.
 * - Control words ("stop"/"pause", "continue"/"resume", "repeat") are recognised at every step.
 * - Spanish words are not understood in 'en', and English words are not understood in 'es'.
 */
import { describe, it, expect } from 'vitest';
import { parseUtterance } from '../../../src/domain/parsing/parseUtterance';

type StepKind = 'sleep' | 'mood' | 'symptoms' | 'confirm' | 'none';

const ALL_STEPS: readonly StepKind[] = ['sleep', 'mood', 'symptoms', 'confirm', 'none'];

describe('parseUtterance (en) - mood words', () => {
  it.each([
    ['very bad', 1],
    ['bad', 2],
    ['okay', 3],
    ['ok', 3],
    ['so so', 3],
    ['good', 4],
    ['very good', 5],
  ])('maps mood phrase "%s" at step mood to %i', (transcript, value) => {
    expect(parseUtterance('mood', transcript, 'en')).toEqual({
      kind: 'value',
      indicator: 'mood',
      value,
    });
  });

  it.each([
    ['one', 1],
    ['two', 2],
    ['three', 3],
    ['four', 4],
    ['five', 5],
  ])('maps mood number word "%s" at step mood to %i', (transcript, value) => {
    expect(parseUtterance('mood', transcript, 'en')).toEqual({
      kind: 'value',
      indicator: 'mood',
      value,
    });
  });

  it('maps "VERY GOOD" at step mood to 5 (case insensitive)', () => {
    expect(parseUtterance('mood', 'VERY GOOD', 'en')).toEqual({
      kind: 'value',
      indicator: 'mood',
      value: 5,
    });
  });
});

describe('parseUtterance (en) - symptoms', () => {
  it.each([
    ['dizziness', 'dizziness'],
    ['dizzy', 'dizziness'],
    ['fainting', 'fainting'],
    ['fainted', 'fainting'],
    ['chest pain', 'chest_pain'],
    ['shortness of breath', 'shortness_of_breath'],
    ['short of breath', 'shortness_of_breath'],
  ])('maps symptom "%s" at step symptoms to [%s]', (transcript, symptom) => {
    expect(parseUtterance('symptoms', transcript, 'en')).toEqual({
      kind: 'symptoms',
      symptoms: [symptom],
    });
  });

  it.each([['none'], ['no']])('maps "%s" at step symptoms to [none]', (transcript) => {
    expect(parseUtterance('symptoms', transcript, 'en')).toEqual({
      kind: 'symptoms',
      symptoms: ['none'],
    });
  });

  it('returns both symptoms for a phrase naming two of them', () => {
    const result = parseUtterance('symptoms', 'dizzy and short of breath', 'en');
    expect(result).toMatchObject({ kind: 'symptoms' });
    expect(new Set((result as { symptoms: string[] }).symptoms)).toEqual(
      new Set(['dizziness', 'shortness_of_breath']),
    );
  });
});

describe('parseUtterance (en) - a symptom negated by a none word', () => {
  it('skips "dizziness" after "no" and returns [none]', () => {
    expect(parseUtterance('symptoms', 'no dizziness', 'en')).toEqual({
      kind: 'symptoms',
      symptoms: ['none'],
    });
  });

  it('skips "dizziness" after "none" and returns [none]', () => {
    expect(parseUtterance('symptoms', 'none dizziness', 'en')).toEqual({
      kind: 'symptoms',
      symptoms: ['none'],
    });
  });

  it('keeps "chest pain" when only "dizziness" is negated', () => {
    expect(parseUtterance('symptoms', 'no dizziness chest pain', 'en')).toEqual({
      kind: 'symptoms',
      symptoms: ['chest_pain'],
    });
  });

  it('keeps "dizziness" when nothing negates it', () => {
    expect(parseUtterance('symptoms', 'dizziness', 'en')).toEqual({
      kind: 'symptoms',
      symptoms: ['dizziness'],
    });
  });
});

describe('parseUtterance (es) - negation is not applied to Spanish symptoms', () => {
  it('keeps "mareo" in "no tengo mareo" as dizziness', () => {
    expect(parseUtterance('symptoms', 'no tengo mareo', 'es')).toEqual({
      kind: 'symptoms',
      symptoms: ['dizziness'],
    });
  });
});

describe('parseUtterance (en) - control words at any step', () => {
  it.each(ALL_STEPS)('maps "stop" to pause at step %s', (step) => {
    expect(parseUtterance(step, 'stop', 'en')).toEqual({ kind: 'intent', intent: 'pause' });
  });

  it.each(ALL_STEPS)('maps "pause" to pause at step %s', (step) => {
    expect(parseUtterance(step, 'pause', 'en')).toEqual({ kind: 'intent', intent: 'pause' });
  });

  it.each(ALL_STEPS)('maps "continue" to resume at step %s', (step) => {
    expect(parseUtterance(step, 'continue', 'en')).toEqual({ kind: 'intent', intent: 'resume' });
  });

  it.each(ALL_STEPS)('maps "resume" to resume at step %s', (step) => {
    expect(parseUtterance(step, 'resume', 'en')).toEqual({ kind: 'intent', intent: 'resume' });
  });

  it.each(ALL_STEPS)('maps "repeat" to repeat at step %s', (step) => {
    expect(parseUtterance(step, 'repeat', 'en')).toEqual({ kind: 'intent', intent: 'repeat' });
  });
});

describe('parseUtterance (en) - confirm step', () => {
  it.each([['yes'], ['yeah'], ['yep']])(
    'maps "%s" at step confirm to confirm',
    (transcript) => {
      expect(parseUtterance('confirm', transcript, 'en')).toEqual({
        kind: 'intent',
        intent: 'confirm',
      });
    },
  );

  it.each([['no'], ['nope']])('maps "%s" at step confirm to deny', (transcript) => {
    expect(parseUtterance('confirm', transcript, 'en')).toEqual({
      kind: 'intent',
      intent: 'deny',
    });
  });

  it('maps "no [unk] correct" at step confirm to deny, not confirm', () => {
    expect(parseUtterance('confirm', 'no [unk] correct', 'en')).toEqual({
      kind: 'intent',
      intent: 'deny',
    });
  });
});

describe('parseUtterance (en) - sleep step', () => {
  it('maps "five" at step sleep to 5 sleep hours', () => {
    expect(parseUtterance('sleep', 'five', 'en')).toEqual({
      kind: 'value',
      indicator: 'sleep_hours',
      value: 5,
    });
  });

  it('maps "seven and a half" at step sleep to 7.5 sleep hours', () => {
    expect(parseUtterance('sleep', 'seven and a half', 'en')).toEqual({
      kind: 'value',
      indicator: 'sleep_hours',
      value: 7.5,
    });
  });

  it('maps "twenty-four" at step sleep to 24 (raw, no range check)', () => {
    expect(parseUtterance('sleep', 'twenty-four', 'en')).toEqual({
      kind: 'value',
      indicator: 'sleep_hours',
      value: 24,
    });
  });
});

describe('parseUtterance (en) - English words are not understood in es', () => {
  it.each([['bad'], ['good'], ['okay'], ['very good'], ['five']])(
    'returns null for mood word "%s" at step mood in es',
    (transcript) => {
      expect(parseUtterance('mood', transcript, 'es')).toBeNull();
    },
  );

  it.each([['dizzy'], ['fainting'], ['chest pain'], ['short of breath']])(
    'returns null for symptom "%s" at step symptoms in es',
    (transcript) => {
      expect(parseUtterance('symptoms', transcript, 'es')).toBeNull();
    },
  );

  it.each([['yes'], ['yeah'], ['yep']])(
    'returns null for "%s" at step confirm in es',
    (transcript) => {
      expect(parseUtterance('confirm', transcript, 'es')).toBeNull();
    },
  );

  it.each([['stop'], ['continue'], ['repeat']])(
    'returns null for control word "%s" in es',
    (transcript) => {
      expect(parseUtterance('none', transcript, 'es')).toBeNull();
    },
  );

  it('returns null for "seven" at step sleep in es', () => {
    expect(parseUtterance('sleep', 'seven', 'es')).toBeNull();
  });
});

describe('parseUtterance (en) - Spanish words are not understood in en', () => {
  it('returns null for "sí" at step confirm in en', () => {
    expect(parseUtterance('confirm', 'sí', 'en')).toBeNull();
  });

  it('returns null for "si" at step confirm in en', () => {
    expect(parseUtterance('confirm', 'si', 'en')).toBeNull();
  });

  it.each([['bien'], ['muy bien'], ['regular'], ['mal'], ['muy mal']])(
    'returns null for mood word "%s" at step mood in en',
    (transcript) => {
      expect(parseUtterance('mood', transcript, 'en')).toBeNull();
    },
  );

  it.each([['mareo'], ['desmayo'], ['dolor de pecho'], ['falta de aire']])(
    'returns null for symptom "%s" at step symptoms in en',
    (transcript) => {
      expect(parseUtterance('symptoms', transcript, 'en')).toBeNull();
    },
  );

  it.each([['para'], ['sigue'], ['repite']])(
    'returns null for control word "%s" in en',
    (transcript) => {
      expect(parseUtterance('none', transcript, 'en')).toBeNull();
    },
  );

  it.each([['cinco horas'], ['cinco'], ['siete y media']])(
    'returns null for Spanish number "%s" at step sleep in en',
    (transcript) => {
      expect(parseUtterance('sleep', transcript, 'en')).toBeNull();
    },
  );
});

describe('parseUtterance (en) - unknown or empty input', () => {
  it.each(ALL_STEPS)('returns null for empty transcript at step %s', (step) => {
    expect(parseUtterance(step, '', 'en')).toBeNull();
  });

  it.each(ALL_STEPS)('returns null for unrecognised transcript at step %s', (step) => {
    expect(parseUtterance(step, 'xyzzy plugh', 'en')).toBeNull();
  });
});
