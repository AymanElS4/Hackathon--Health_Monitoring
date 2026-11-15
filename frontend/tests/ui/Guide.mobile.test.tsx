/** Guide screen: collapsed accordion cards below 768 px, unchanged details at >= 768 px. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_LOCALE, resetLocaleCache, setLocale } from '../../src/config/i18n';
import { Guide } from '../../src/ui/screens/Guide';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  );
}

function renderGuide() {
  return render(
    <MemoryRouter>
      <Guide />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetLocaleCache();
  setLocale(DEFAULT_LOCALE);
});

describe('Guide mobile accordion', () => {
  it('shows protocol cards collapsed and opens only one at a time', () => {
    setLocale('es');
    stubMatchMedia(false);
    renderGuide();
    const cards = screen
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-controls'));
    expect(cards).toHaveLength(5);
    expect(cards.every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(screen.queryByText('Ver equipo')).toBeNull();

    fireEvent.click(cards[0]);
    expect(cards[0].getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByText('Ver equipo')).toHaveLength(1);

    fireEvent.click(cards[1]);
    expect(cards[0].getAttribute('aria-expanded')).toBe('false');
    expect(cards[1].getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByText('Ver equipo')).toHaveLength(1);

    fireEvent.click(screen.getByText('Ver equipo'));
    expect(screen.getByText('Ocultar equipo')).toBeTruthy();
  });

  it('still filters by translated text', () => {
    setLocale('en');
    stubMatchMedia(false);
    renderGuide();
    fireEvent.change(screen.getByPlaceholderText('Search the manual...'), { target: { value: 'glucose' } });
    expect(screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-controls'))).toHaveLength(1);
  });

  it('keeps the full details rendering on desktop', () => {
    setLocale('es');
    stubMatchMedia(true);
    renderGuide();
    expect(screen.queryByText('Ver equipo')).toBeNull();
    expect(screen.getAllByText('Objetivo de la Medición')).toHaveLength(5);
    expect(screen.getAllByText('Equipamiento Requerido')).toHaveLength(5);
  });
});
