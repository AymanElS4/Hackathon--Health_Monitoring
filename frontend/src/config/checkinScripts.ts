/**
 * Daily check-in script as plain data (contracts/checkin-script.md).
 *
 * `config/` must not import domain types, so this file is untyped data. The
 * application passes `checkinScripts.daily` to the reducer, which type-checks it
 * against `CheckinScript` (wired in T052). Spanish text lives only in messages.es.ts.
 */

/** Control words accepted in every listening step: pause, resume, repeat. */
export const CONTROL_WORDS = ['para', 'sigue', 'repite'] as const;

/** Vosk unknown-word token; always part of a listening grammar. */
const UNKNOWN = '[unk]';

/** Sleep hours as Vosk outputs them: number words 0–24, "y media" for half hours. */
export const SLEEP_GRAMMAR = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'y', 'media', 'horas', 'hora',
  ...CONTROL_WORDS,
  UNKNOWN,
] as const;

/** Mood: a 1–5 scale word or a mood word. */
export const MOOD_GRAMMAR = [
  'uno', 'dos', 'tres', 'cuatro', 'cinco',
  'muy', 'mal', 'regular', 'bien',
  ...CONTROL_WORDS,
  UNKNOWN,
] as const;

/** Symptom whitelist; "no" and "ninguno" mean no symptom. */
export const SYMPTOM_GRAMMAR = [
  'mareo', 'desmayo', 'dolor', 'de', 'pecho', 'falta', 'aire', 'no', 'ninguno',
  ...CONTROL_WORDS,
  UNKNOWN,
] as const;

/** Yes or no answers (confirmations). */
export const CONFIRM_GRAMMAR = [
  'sí', 'si', 'no',
  ...CONTROL_WORDS,
  UNKNOWN,
] as const;

/** Answers to the closing "next activity" question. */
export const NEXT_GRAMMAR = [
  'sí', 'si',
  ...CONTROL_WORDS,
  UNKNOWN,
] as const;

export const checkinScripts = {
  daily: [
    { id: 'greeting', kind: 'say', messageKey: 'greet' },
    {
      id: 'ask_sleep',
      kind: 'ask',
      messageKey: 'ask.sleep',
      parse: 'sleep',
      grammar: SLEEP_GRAMMAR,
      focus: 'sleep',
      indicator: 'sleep_hours',
    },
    {
      id: 'confirm_sleep',
      kind: 'confirm',
      messageKey: 'confirm.sleep',
      parse: 'confirm',
      grammar: CONFIRM_GRAMMAR,
      focus: 'sleep',
      indicator: 'sleep_hours',
    },
    {
      id: 'ask_mood',
      kind: 'ask',
      messageKey: 'ask.mood',
      parse: 'mood',
      grammar: MOOD_GRAMMAR,
      focus: 'sleep',
      indicator: 'mood',
    },
    {
      id: 'confirm_mood',
      kind: 'confirm',
      messageKey: 'confirm.mood',
      parse: 'confirm',
      grammar: CONFIRM_GRAMMAR,
      focus: 'sleep',
      indicator: 'mood',
    },
    {
      id: 'ask_symptoms',
      kind: 'ask',
      messageKey: 'ask.symptoms',
      parse: 'symptoms',
      grammar: SYMPTOM_GRAMMAR,
      focus: null,
    },
    // Focus per device (pressure, pulse, oxygen, temperature; 1 s each) is handled by the reducer.
    { id: 'measuring', kind: 'measure', messageKey: 'measure' },
    // The reducer resolves the concrete verdict.* and action.* keys from the evaluation result.
    { id: 'summary', kind: 'summary', messageKey: 'verdict.ok' },
    {
      id: 'next_activity',
      kind: 'next',
      messageKey: 'next',
      grammar: NEXT_GRAMMAR,
      focus: null,
    },
  ],
} as const;
