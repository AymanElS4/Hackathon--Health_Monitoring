import { describe, expect, it } from 'vitest';
import { messages } from '../../src/config/messages.es';
import { MESSAGES_EN } from '../../src/config/messages.en';
import { checkinScripts } from '../../src/config/checkinScripts';
import { parseUtterance } from '../../src/domain/parsing/parseUtterance';

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();

describe('English catalog', () => {
  it('has exactly the same keys as the Spanish catalog', () => {
    const es = Object.keys(messages);
    const en = Object.keys(MESSAGES_EN);
    expect(es.filter((k) => !(k in MESSAGES_EN))).toEqual([]);
    expect(en.filter((k) => !(k in messages))).toEqual([]);
  });

  it('keeps the same placeholders for every key', () => {
    for (const key of Object.keys(messages)) {
      expect(placeholders(MESSAGES_EN[key] ?? ''), key).toEqual(placeholders(messages[key] ?? ''));
    }
  });

  it('keeps icon values unchanged', () => {
    for (const key of Object.keys(messages).filter((k) => k.endsWith('.icon'))) {
      expect(MESSAGES_EN[key]).toBe(messages[key]);
    }
  });
});

/** Keys Vita speaks: the script messages plus every dialogue line runCheckin can speak. */
const isSpokenKey = (key: string): boolean =>
  key === 'greet' ||
  key === 'measure' ||
  key.startsWith('measure.') ||
  key.startsWith('ask.') ||
  key.startsWith('confirm.') ||
  key.startsWith('retry.') ||
  key.startsWith('verdict.') ||
  key.startsWith('action.') ||
  key.startsWith('next');

/** Spanish function words and phrases that must not appear in English spoken lines. */
const SPANISH_WORDS = [
  'de', 'del', 'la', 'el', 'los', 'las', 'que', 'tu', 'tus', 'y', 'en', 'es', 'lo', 'un', 'una',
  'para', 'con', 'hoy', 'ahora', 'repite', 'dormiste', 'dime', 'escuché', 'mide', 'hora', 'horas',
  'temperatura', 'sueño', 'pulso', 'presión', 'oxígeno', 'síntoma', 'ánimo', 'bien', 'mal', 'sí',
  'si', 'dolor', 'falta', 'avisa', 'tómalo', 'descansa', 'vuelvo', 'lo', 'próximo', 'más', 'hay',
];
const SPANISH_CHARACTERS = /[áéíóúñü¿¡]/iu;

describe('English spoken lines', () => {
  const spokenKeys = Object.keys(messages).filter(isSpokenKey);

  it('covers every script message and the dialogue lines', () => {
    const scriptKeys = checkinScripts.daily.flatMap((step) =>
      'messageKey' in step ? [step.messageKey] : [],
    );
    for (const key of [...scriptKeys, 'confirm.sleep.one', 'next.none', 'measure.temperature.again']) {
      expect(spokenKeys, key).toContain(key);
    }
    expect(spokenKeys.length).toBeGreaterThan(20);
  });

  it('exists in English, non-empty, and contains no Spanish words', () => {
    for (const key of spokenKeys) {
      const text = MESSAGES_EN[key];
      expect(text, `missing English key: ${key}`).toBeTruthy();
      expect(text, `Spanish character in ${key}`).not.toMatch(SPANISH_CHARACTERS);
      const words = (text ?? '').toLowerCase().match(/\p{L}+/gu) ?? [];
      for (const word of SPANISH_WORDS) {
        expect(words, `Spanish word "${word}" in ${key}`).not.toContain(word);
      }
    }
  });

  it('keeps the spoken English numbers free of Spanish decimal commas', () => {
    expect(MESSAGES_EN['confirm.sleep']).not.toMatch(/\d,\d/);
    expect(MESSAGES_EN['confirm.mood']).not.toMatch(/\d,\d/);
  });
});

describe('English chip labels are understood by the English parser', () => {
  const YES_NO: ReadonlyArray<readonly [string, 'confirm' | 'deny']> = [
    ['checkin.yes', 'confirm'],
    ['checkin.no', 'deny'],
  ];
  const SYMPTOMS: ReadonlyArray<readonly [string, string]> = [
    ['checkin.symptom.mareo', 'dizziness'],
    ['checkin.symptom.desmayo', 'fainting'],
    ['checkin.symptom.chestPain', 'chest_pain'],
    ['checkin.symptom.breathless', 'shortness_of_breath'],
    ['checkin.symptom.none', 'none'],
  ];

  it('reads yes and no as confirm and deny at the confirm step', () => {
    for (const [key, intent] of YES_NO) {
      const label = MESSAGES_EN[key] ?? '';
      expect(parseUtterance('confirm', label.toLowerCase(), 'en'), key).toEqual({
        kind: 'intent',
        intent,
      });
    }
  });

  it('reads every symptom chip label at the symptoms step', () => {
    for (const [key, symptom] of SYMPTOMS) {
      const label = MESSAGES_EN[key] ?? '';
      expect(parseUtterance('symptoms', label.toLowerCase(), 'en'), key).toEqual({
        kind: 'symptoms',
        symptoms: [symptom],
      });
    }
  });
});

describe('English symptom prompt', () => {
  it('asks about the symptoms by name and says "none" when there are none', () => {
    expect(MESSAGES_EN['ask.symptoms']).toBe(
      'Do you have dizziness, fainting, chest pain or shortness of breath? Say none if not.',
    );
  });

  it('keeps the Spanish symptom prompt unchanged', () => {
    expect(messages['ask.symptoms']).toBe('¿Tienes algún síntoma?');
  });
});
