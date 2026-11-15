/**
 * Language of the check-in reducer (006 T004). The state carries a voice language: it picks the
 * listening grammar of each step and the parser words. 'es' is the default and is unchanged.
 */
import { describe, it, expect } from 'vitest';
import { checkinScripts, SLEEP_GRAMMAR } from '../../../src/config/checkinScripts';
import type { CheckinEvent, CheckinScript, Effect } from '../../../src/domain/checkin/types';
import type { CheckinState } from '../../../src/domain/checkin/checkinReducer';
import { checkinReducer, createCheckinState } from '../../../src/domain/checkin/checkinReducer';

const script: CheckinScript = checkinScripts.daily;
const tx = (text: string | null): CheckinEvent => ({ type: 'transcript', text });

/** A fresh check-in in `language`, spoken through the greeting so it listens at ask_sleep. */
function atAskSleep(language?: 'es' | 'en'): { state: CheckinState; effects: Effect[] } {
  const created = createCheckinState(language === undefined ? { script } : { script, language });
  const started = checkinReducer(created, { type: 'start' });
  return checkinReducer(started.state, { type: 'spoken' });
}

describe('check-in language', () => {
  it('defaults to Spanish when no language is given', () => {
    expect(createCheckinState({ script }).language).toBe('es');
  });

  it('en: the ask_sleep listen effect carries the English sleep grammar', () => {
    const { state, effects } = atAskSleep('en');
    expect(state.language).toBe('en');
    expect(effects).toContainEqual({ type: 'listen', grammar: [...SLEEP_GRAMMAR.en] });
  });

  it('en: "seven and a half" at ask_sleep proposes 7.5 and "yes" confirms it', () => {
    const asked = atAskSleep('en');
    const heard = checkinReducer(asked.state, tx('seven and a half'));
    expect(heard.state.pending).toEqual({ indicator: 'sleep_hours', value: 7.5 });
    expect(heard.state.step).toBe('confirm_sleep');
    expect(heard.effects).toContainEqual({ type: 'speak', key: 'confirm.sleep', params: { hours: 7.5 } });

    const confirmed = checkinReducer(heard.state, tx('yes'));
    expect(confirmed.state.confirmedVoice).toEqual([{ indicator: 'sleep_hours', value: 7.5 }]);
    expect(confirmed.state.pending).toBeNull();
    expect(confirmed.state.step).toBe('ask_mood');
  });

  it('es: the ask_sleep listen effect carries the Spanish sleep grammar', () => {
    const { effects } = atAskSleep();
    expect(effects).toContainEqual({ type: 'listen', grammar: [...SLEEP_GRAMMAR.es] });
  });

  it('es: "siete y media" proposes 7.5 and "sí" confirms, as before', () => {
    const heard = checkinReducer(atAskSleep().state, tx('siete y media'));
    expect(heard.state.pending).toEqual({ indicator: 'sleep_hours', value: 7.5 });

    const confirmed = checkinReducer(heard.state, tx('sí'));
    expect(confirmed.state.confirmedVoice).toEqual([{ indicator: 'sleep_hours', value: 7.5 }]);
  });

  it('es: English number words are not understood at ask_sleep', () => {
    const { state, effects } = checkinReducer(atAskSleep().state, tx('seven and a half'));
    expect(state.pending).toBeNull();
    expect(state.step).toBe('ask_sleep');
    expect(effects).toEqual([{ type: 'listen', grammar: [...SLEEP_GRAMMAR.es] }]);
  });
});
