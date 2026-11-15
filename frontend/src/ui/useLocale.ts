import { useSyncExternalStore } from 'react';
import { getLocale, subscribeLocale, type Locale } from '../config/i18n';

/** Subscribes the component to locale changes so it re-renders. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}
