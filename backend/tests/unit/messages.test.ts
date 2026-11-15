import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Indicator, Level, SensorKey, Symptom, Verdict } from '../../src/shared/contracts';
import { MESSAGES_ES } from '../../src/config/messages.es';
import { ALERT_DECISIONS } from '../../src/application/use-cases/decide-alert';

/** Words that must never appear in surgeon-page text (constitution, principle VI). */
const FORBIDDEN_WORDS = [
  'diagnóstico',
  'diagnostica',
  'diagnosis',
  'medicamento',
  'medicación',
  'dosis',
  'tome ',
  'tomar ',
  'pastilla',
];

/** Tablet messages, read-only; the surgeon page mirrors their action.* keys. */
const TABLET_MESSAGES_PATH = path.resolve(
  __dirname,
  '../../../frontend/src/config/messages.es.ts',
);
const ACTION_ENTRY = /'(action\.[a-z_]+)':\s*'([^']*)'/g;

const messages: Record<string, string> = MESSAGES_ES;

describe('surgeon messages (MESSAGES_ES)', () => {
  it('contains no forbidden diagnosis or medication words', () => {
    for (const [key, value] of Object.entries(messages)) {
      const lower = value.toLowerCase();
      for (const word of FORBIDDEN_WORDS) {
        expect(lower, `${key} contains "${word}"`).not.toContain(word);
      }
    }
  });

  it.each([
    ['Verdict', Verdict.options, 'verdict'],
    ['Symptom', Symptom.options, 'symptom'],
    ['Indicator', Indicator.options, 'indicator'],
    ['SensorKey', SensorKey.options, 'sensor'],
    ['Level', Level.options, 'level'],
    ['AlertDecision', ALERT_DECISIONS, 'decision'],
    ['Urgency', ['now', 'soon'], 'urgency'],
  ])('has a key for every %s value', (_name, values, prefix) => {
    for (const value of values) {
      expect(messages, `${prefix}.${value}`).toHaveProperty([`${prefix}.${value}`]);
    }
  });

  it('has the same text as the tablet for every action.* key', () => {
    const tabletText = fs.readFileSync(TABLET_MESSAGES_PATH, 'utf8');
    const tabletActions = [...tabletText.matchAll(ACTION_ENTRY)];
    expect(tabletActions.length).toBeGreaterThan(0);
    for (const [, key, value] of tabletActions) {
      expect(messages[key], `${key} missing here`).toBeDefined();
      expect(messages[key], key).toBe(value);
    }
  });
});
