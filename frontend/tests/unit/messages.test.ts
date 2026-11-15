import { describe, it, expect } from 'vitest';
import { messages } from '../../src/config/messages.es';
import { checkinScripts } from '../../src/config/checkinScripts';

/** Keys the check-in script contract (contracts/checkin-script.md) and T016 require. */
const REQUIRED_KEYS = [
  'greet',
  'ask.sleep',
  'confirm.sleep',
  'ask.mood',
  'confirm.mood',
  'ask.symptoms',
  'measure',
  'verdict.ok',
  'verdict.attention',
  'verdict.alert',
  'action.slept_little',
  'action.missing_data',
  'action.symptom',
  'retry.sleep',
  'retry.mood',
  'next',
  'team.criterion',
  'team.criterion.mark',
  'team.criterion.note',
  'dot.label',
  'scenario.resetWarning',
] as const;

/** Disease and medication words that must never appear in verdict or action text (Principle VI). */
const BLOCKLIST = [
  'diagnóstico',
  'hipertensión',
  'taquicardia',
  'bradicardia',
  'hipoxemia',
  'hipotermia',
  'insomnio',
  'depresión',
  'medicamento',
  'pastilla',
  'tome ',
];

describe('messages.es', () => {
  it('exports a flat string record', () => {
    for (const [key, value] of Object.entries(messages)) {
      expect(typeof key).toBe('string');
      expect(typeof value).toBe('string');
    }
  });

  it('contains every key required by the check-in script contract', () => {
    for (const key of REQUIRED_KEYS) {
      expect(messages, `missing key: ${key}`).toHaveProperty([key]);
      expect(messages[key], `empty value: ${key}`).toBeTruthy();
    }
  });

  it('every key used by the daily check-in script and its dialogue exists', () => {
    const scriptKeys = checkinScripts.daily.flatMap((step) =>
      'messageKey' in step ? [step.messageKey] : [],
    );
    const dialogueKeys = [
      'confirm.sleep',
      'confirm.mood',
      'retry.sleep',
      'retry.mood',
      'verdict.ok',
      'verdict.attention',
      'verdict.alert',
      'action.symptom',
      'action.red',
      'action.fever',
      'action.two_amber',
      'action.slept_little',
      'action.missing_data',
      'action.in_doubt',
      'action.outside_normal',
      'action.single_amber',
    ];
    for (const key of [...scriptKeys, ...dialogueKeys]) {
      expect(messages, `missing key: ${key}`).toHaveProperty([key]);
      expect(messages[key], `empty value: ${key}`).toBeTruthy();
    }
  });

  it('no verdict.* or action.* text contains a blocklisted disease or medication word', () => {
    const keys = Object.keys(messages).filter(
      (key) => key.startsWith('verdict.') || key.startsWith('action.'),
    );
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const text = messages[key].toLowerCase();
      for (const word of BLOCKLIST) {
        expect(text, `"${word}" found in ${key}`).not.toContain(word);
      }
    }
  });

  it('team.criterion is exactly "criterio del equipo, no clínico"', () => {
    expect(messages['team.criterion']).toBe('criterio del equipo, no clínico');
  });

  it('team.criterion.note is exactly "* criterio del equipo, no clínico"', () => {
    expect(messages['team.criterion.note']).toBe('* criterio del equipo, no clínico');
  });

  it('team.criterion.mark is exactly "*"', () => {
    expect(messages['team.criterion.mark']).toBe('*');
  });

  it('confirm.sleep contains the {hours} placeholder', () => {
    expect(messages['confirm.sleep']).toContain('{hours}');
  });

  it('dot.label contains the {reason} and {level} placeholders', () => {
    expect(messages['dot.label']).toContain('{reason}');
    expect(messages['dot.label']).toContain('{level}');
  });

  it('retry.sleep asks for a number between 0 and 16', () => {
    expect(messages['retry.sleep']).toContain('16');
    expect(messages['retry.sleep']).not.toContain('24');
  });

  it('action.missing_data contains the {sensor} placeholder', () => {
    expect(messages['action.missing_data']).toContain('{sensor}');
  });
});
