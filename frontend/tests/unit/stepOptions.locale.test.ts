/**
 * Sleep chip labels follow the UI locale (006 review finding 7): "7.5 h" in English, "7,5 h" in Spanish.
 */
import { describe, it, expect } from 'vitest';
import { optionsFor } from '../../src/ui/components/chat/stepOptions';
import { setLocale } from '../../src/config/i18n';

const labelOf = (value: string): string | undefined =>
  optionsFor('ask_sleep').find((option) => option.value === value)?.label;

describe('sleep hour chips follow the UI locale', () => {
  it('labels 7.5 hours as "7.5 h" in English', () => {
    setLocale('en');
    expect(labelOf('7.5')).toBe('7.5 h');
  });

  it('labels 7.5 hours as "7,5 h" in Spanish', () => {
    setLocale('es');
    expect(labelOf('7.5')).toBe('7,5 h');
  });
});
