import { describe, expect, it } from 'vitest';
import { messages } from '../../src/config/messages.es';
import { MESSAGES_EN } from '../../src/config/messages.en';

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
