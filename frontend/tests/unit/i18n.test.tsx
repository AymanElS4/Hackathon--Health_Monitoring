import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocale, resetLocaleCache, setLocale, LOCALE_STORAGE_KEY } from '../../src/config/i18n';
import { messages, t, tVoice } from '../../src/config/messages.es';
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

describe('tVoice', () => {
  it('is always Spanish while the UI is English', () => {
    setLocale('en');
    expect(tVoice('verdict.ok')).toBe(messages['verdict.ok']);
    expect(tVoice('confirm.sleep', { hours: 7 })).toContain('dormiste');
    if (MESSAGES_EN['verdict.ok']) expect(t('verdict.ok')).toBe(MESSAGES_EN['verdict.ok']);
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
