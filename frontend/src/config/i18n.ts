/**
 * UI locale store: tiny external store (useSyncExternalStore-compatible).
 * The screen follows this locale; the voice follows the language chosen when a check-in starts (006).
 */
export type Locale = 'es' | 'en';
export const LOCALE_STORAGE_KEY = 'bv.locale';
export const DEFAULT_LOCALE: Locale = 'en';

function readStored(): Locale {
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return value === 'es' || value === 'en' ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

let current: Locale | null = null;
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  if (current === null) current = readStored();
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage unavailable: the choice still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper: forget the in-memory locale so the next read goes to storage again. */
export function resetLocaleCache(): void {
  current = null;
}
