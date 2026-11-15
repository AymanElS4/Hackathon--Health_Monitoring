/** Guide screen: renders in both locales and both catalogs have the same keys. */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GUIDE_EN } from '../../src/config/catalogs/guide.en';
import { GUIDE_ES } from '../../src/config/catalogs/guide.es';
import { DEFAULT_LOCALE, resetLocaleCache, setLocale } from '../../src/config/i18n';
import { Guide } from '../../src/ui/screens/Guide';

function renderGuide() {
  return render(
    <MemoryRouter>
      <Guide />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetLocaleCache();
  setLocale(DEFAULT_LOCALE);
});

describe('Guide i18n', () => {
  it('has the same keys in Spanish and English, all prefixed guide.', () => {
    const es = Object.keys(GUIDE_ES).sort();
    const en = Object.keys(GUIDE_EN).sort();
    expect(en).toEqual(es);
    expect(es.every((key) => key.startsWith('guide.'))).toBe(true);
    for (const key of es) {
      const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
      expect(placeholders(GUIDE_EN[key]), key).toEqual(placeholders(GUIDE_ES[key]));
    }
  });

  it('renders in Spanish', () => {
    setLocale('es');
    renderGuide();
    expect(screen.getByText('Volver a Hoy')).toBeTruthy();
    expect(screen.getByText('Todos (5)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Buscar en el manual...')).toBeTruthy();
  });

  it('renders in English and switches language', () => {
    setLocale('es');
    renderGuide();
    expect(screen.getByText('Volver a Hoy')).toBeTruthy();
    act(() => setLocale('en'));
    expect(screen.getByText('Back to Today')).toBeTruthy();
    expect(screen.queryByText('Volver a Hoy')).toBeNull();
    expect(screen.getByText('All (5)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search the manual...')).toBeTruthy();
  });
});
