import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocale, resetLocaleCache, setLocale, LOCALE_STORAGE_KEY } from '../../src/config/i18n';
import { formatNumber, messages, t, tVoice } from '../../src/config/messages.es';
import { MESSAGES_EN } from '../../src/config/messages.en';
import { LanguageToggle } from '../../src/ui/components/LanguageToggle';

afterEach(() => vi.restoreAllMocks());

describe('locale store', () => {
  it('defaults to en when nothing is stored', () => {
    window.localStorage.clear();
    resetLocaleCache();
    expect(getLocale()).toBe('en');
  });

  it('persists the choice and reads it back', () => {
    setLocale('es');
    resetLocaleCache();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    expect(getLocale()).toBe('es');
  });

  it('does not crash when localStorage throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    resetLocaleCache();
    expect(getLocale()).toBe('en');
    expect(() => setLocale('es')).not.toThrow();
    expect(getLocale()).toBe('es');
  });
});

describe('formatNumber', () => {
  it('uses a decimal comma in Spanish and a decimal point in English', () => {
    expect(formatNumber(7.5)).toBe('7,5');
    expect(formatNumber(7.5, 'es')).toBe('7,5');
    expect(formatNumber(7.5, 'en')).toBe('7.5');
  });

  it('keeps at most one decimal and no grouping in both languages', () => {
    expect(formatNumber(16, 'en')).toBe('16');
    expect(formatNumber(7.25, 'en')).toBe('7.3');
    expect(formatNumber(7.25, 'es')).toBe('7,3');
  });
});

describe('tVoice', () => {
  it('defaults to Spanish whatever the UI locale is', () => {
    setLocale('en');
    expect(tVoice('verdict.ok')).toBe(messages['verdict.ok']);
    expect(tVoice('confirm.sleep', { hours: 7 })).toContain('dormiste');
    if (MESSAGES_EN['verdict.ok']) expect(t('verdict.ok')).toBe(MESSAGES_EN['verdict.ok']);
  });

  it('speaks English when asked for English', () => {
    expect(tVoice('greet', undefined, 'en')).toBe(MESSAGES_EN.greet);
    expect(tVoice('verdict.ok', undefined, 'en')).toBe(MESSAGES_EN['verdict.ok']);
  });

  it('formats numbers in the spoken language: 7.5 is "7.5" in English and "7,5" in Spanish', () => {
    expect(tVoice('confirm.sleep', { hours: 7.5 }, 'en')).toBe(
      'I heard you slept 7.5 hours. Is that right?',
    );
    expect(tVoice('confirm.sleep', { hours: 7.5 }, 'es')).toBe(
      'Escuché que dormiste 7,5 horas. ¿Es correcto?',
    );
    expect(tVoice('confirm.sleep', { hours: 7.5 })).toContain('7,5');
  });
});

describe('t follows the UI locale for numbers', () => {
  it('formats 7.5 as "7.5" in English and "7,5" in Spanish', () => {
    setLocale('en');
    expect(t('confirm.sleep', { hours: 7.5 })).toContain('7.5');
    setLocale('es');
    expect(t('confirm.sleep', { hours: 7.5 })).toContain('7,5');
  });
});

describe('LanguageToggle', () => {
  it('switches the locale and bolds the active language', () => {
    setLocale('en');
    render(<LanguageToggle />);
    expect(screen.getByText('EN')).toHaveClass('font-bold');
    fireEvent.click(screen.getByRole('button'));
    expect(getLocale()).toBe('es');
    expect(screen.getByText('ES')).toHaveClass('font-bold');
  });
});
