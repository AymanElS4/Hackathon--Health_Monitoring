/**
 * The voice language follows the UI locale on screen changes, but not while a check-in runner
 * is active (006 review finding 4). The helper lives in the composition root.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { followLocaleForVoice, type VoiceLanguageHolder } from '../../src/composition-root';
import { setLocale } from '../../src/config/i18n';

let unsubscribe: (() => void) | undefined;

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
});

describe('followLocaleForVoice', () => {
  it('updates the voice language when the locale changes and no check-in is active', () => {
    const holder: VoiceLanguageHolder = { current: 'es' };
    unsubscribe = followLocaleForVoice(holder, () => false);
    setLocale('en');
    expect(holder.current).toBe('en');
    setLocale('es');
    expect(holder.current).toBe('es');
  });

  it('keeps the voice language while a check-in is active', () => {
    const holder: VoiceLanguageHolder = { current: 'es' };
    let active = true;
    unsubscribe = followLocaleForVoice(holder, () => active);
    setLocale('en');
    expect(holder.current).toBe('es');
    active = false;
    setLocale('en');
    expect(holder.current).toBe('en');
  });

  it('stops following after unsubscribe', () => {
    const holder: VoiceLanguageHolder = { current: 'es' };
    const stop = followLocaleForVoice(holder, () => false);
    stop();
    setLocale('en');
    expect(holder.current).toBe('es');
  });
});
