/**
 * Tests for the chat transcript (T080a). `advanceConversation` turns successive runner snapshots
 * into an ordered list of messages: Vita's lines, Ana's heard and confirmed answers, "No", the
 * symptoms and the verdict as the last message. Pure: no React, no DOM.
 */
import { describe, it, expect } from 'vitest';
import type { CheckinSnapshot, SpokenLine } from '../../src/application/use-cases/runCheckin';
import {
  advanceConversation,
  createConversationState,
  type ChatMessage,
  type ConversationState,
} from '../../src/ui/conversation';
import { t } from '../../src/config/messages.es';

function snapshot(patch: Partial<CheckinSnapshot> = {}): CheckinSnapshot {
  return {
    step: 'idle',
    paused: false,
    focus: null,
    caption: null,
    listening: false,
    outcome: null,
    buttonsFor: null,
    nextItem: null,
    saveFailed: false,
    readings: [],
    speaking: false,
    spoken: [],
    pending: null,
    confirmedVoice: [],
    symptoms: [],
    ...patch,
  };
}

/** Feeds snapshots one by one, the way the hook does, and returns the final state. */
function run(snapshots: CheckinSnapshot[]): ConversationState {
  return snapshots.reduce(advanceConversation, createConversationState());
}

function line(id: number, text: string, step: SpokenLine['step']): SpokenLine {
  return { id, text, step };
}

const texts = (messages: readonly ChatMessage[]) =>
  messages.map((message) => (message.kind === 'verdict' ? 'verdict' : message.text));

describe('advanceConversation', () => {
  it('lists Vita lines in the order they were spoken', () => {
    const state = run([
      snapshot({ step: 'greeting', spoken: [line(1, t('greet'), 'greeting')] }),
      snapshot({
        step: 'ask_sleep',
        spoken: [line(1, t('greet'), 'greeting'), line(2, t('ask.sleep'), 'ask_sleep')],
      }),
    ]);

    expect(texts(state.messages)).toEqual([t('greet'), t('ask.sleep')]);
    expect(state.messages.every((message) => message.kind === 'vita')).toBe(true);
  });

  it('does not add a message twice when the same snapshot arrives again', () => {
    const snap = snapshot({ step: 'ask_sleep', spoken: [line(1, t('ask.sleep'), 'ask_sleep')] });
    const once = run([snap]);
    const twice = advanceConversation(once, snap);

    expect(texts(twice.messages)).toEqual([t('ask.sleep')]);
  });

  it('a heard value is a live Ana bubble, then solid once confirmed, before the confirm line', () => {
    const question = snapshot({ step: 'ask_sleep', spoken: [line(1, t('ask.sleep'), 'ask_sleep')] });
    const heard = snapshot({
      step: 'confirm_sleep',
      pending: { indicator: 'sleep_hours', value: 5 },
      spoken: [line(1, t('ask.sleep'), 'ask_sleep'), line(2, t('confirm.sleep', { hours: 5 }), 'confirm_sleep')],
    });
    const live = run([question, heard]);

    expect(texts(live.messages)).toEqual([t('ask.sleep'), '5 horas', t('confirm.sleep', { hours: 5 })]);
    const liveBubble = live.messages[1];
    expect(liveBubble).toMatchObject({ kind: 'ana', live: true });

    const confirmed = advanceConversation(live, snapshot({
      step: 'ask_mood',
      confirmedVoice: [{ indicator: 'sleep_hours', value: 5 }],
      spoken: heard.spoken.concat(line(3, t('ask.mood'), 'ask_mood')),
    }));
    expect(texts(confirmed.messages)).toEqual([
      t('ask.sleep'),
      '5 horas',
      t('confirm.sleep', { hours: 5 }),
      t('checkin.yes'),
      t('ask.mood'),
    ]);
    expect(confirmed.messages[1]).toMatchObject({ kind: 'ana', live: false });
    expect(confirmed.messages).toHaveLength(5);
  });

  it('a singular hour reads "1 hora"', () => {
    const state = run([
      snapshot({
        step: 'ask_mood',
        confirmedVoice: [{ indicator: 'sleep_hours', value: 1 }],
        spoken: [line(1, t('ask.mood'), 'ask_mood')],
      }),
    ]);

    expect(texts(state.messages)).toEqual(['1 hora', t('checkin.yes'), t('ask.mood')]);
  });

  it('a mood answer reads "N de 5" as Ana\'s solid bubble', () => {
    const state = run([
      snapshot({
        step: 'ask_symptoms',
        confirmedVoice: [
          { indicator: 'sleep_hours', value: 7 },
          { indicator: 'mood', value: 4 },
        ],
        spoken: [line(1, t('ask.symptoms'), 'ask_symptoms')],
      }),
    ]);

    expect(texts(state.messages)).toEqual([
      '7 horas',
      t('checkin.yes'),
      '4 de 5',
      t('checkin.yes'),
      t('ask.symptoms'),
    ]);
  });

  it('"no" at a confirm step removes the live bubble and shows Ana\'s "No" before the question again', () => {
    const state = run([
      snapshot({
        step: 'confirm_sleep',
        pending: { indicator: 'sleep_hours', value: 5 },
        spoken: [line(1, t('ask.sleep'), 'ask_sleep'), line(2, t('confirm.sleep', { hours: 5 }), 'confirm_sleep')],
      }),
      snapshot({
        step: 'ask_sleep',
        spoken: [
          line(1, t('ask.sleep'), 'ask_sleep'),
          line(2, t('confirm.sleep', { hours: 5 }), 'confirm_sleep'),
          line(3, t('ask.sleep'), 'ask_sleep'),
        ],
      }),
    ]);

    expect(texts(state.messages)).toEqual([
      t('ask.sleep'),
      t('confirm.sleep', { hours: 5 }),
      t('checkin.no'),
      t('ask.sleep'),
    ]);
  });

  it('symptoms are Ana\'s answer, listed with their labels', () => {
    const state = run([
      snapshot({
        step: 'measuring',
        symptoms: ['dizziness', 'chest_pain'],
        spoken: [line(1, t('measure'), 'measuring')],
      }),
    ]);

    expect(texts(state.messages)).toEqual(['Mareo, Dolor de pecho', t('measure')]);
  });

  it('"Ninguno" is shown for no symptoms', () => {
    const state = run([snapshot({ step: 'measuring', symptoms: ['none'] })]);

    expect(texts(state.messages)).toEqual(['Ninguno']);
  });

  it('summary and next-activity lines are folded into the verdict, which comes last', () => {
    const outcome = {
      verdict: 'attention' as const,
      actionKey: 'action.slept_little',
      actionParams: {},
      teamCriterion: false,
    };
    const state = run([
      snapshot({
        step: 'measuring',
        spoken: [line(1, t('measure'), 'measuring')],
      }),
      snapshot({
        step: 'summary',
        outcome,
        spoken: [
          line(1, t('measure'), 'measuring'),
          line(2, t('verdict.attention'), 'summary'),
          line(3, t('action.slept_little'), 'summary'),
        ],
      }),
      snapshot({
        step: 'next_activity',
        outcome,
        spoken: [
          line(1, t('measure'), 'measuring'),
          line(2, t('verdict.attention'), 'summary'),
          line(3, t('action.slept_little'), 'summary'),
          line(4, t('next', { title: 'Ejercicio', time: '10:00' }), 'next_activity'),
        ],
      }),
    ]);

    expect(texts(state.messages)).toEqual([t('measure'), 'verdict']);
    expect(state.messages[state.messages.length - 1]).toMatchObject({ kind: 'verdict' });
  });
  it('the live bubble follows the heard value while it waits (refreshed when pending changes)', () => {
    const state = run([
      snapshot({ step: 'ask_mood', spoken: [line(1, t('ask.mood'), 'ask_mood')] }),
      snapshot({
        step: 'confirm_mood',
        pending: { indicator: 'mood', value: 3 },
        spoken: [line(1, t('ask.mood'), 'ask_mood'), line(2, t('confirm.mood', { mood: 3 }), 'confirm_mood')],
      }),
      snapshot({
        step: 'confirm_mood',
        pending: { indicator: 'mood', value: 4 },
        spoken: [line(1, t('ask.mood'), 'ask_mood'), line(2, t('confirm.mood', { mood: 3 }), 'confirm_mood')],
      }),
    ]);

    const live = state.messages.filter((message) => message.kind === 'ana');
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ text: '4 de 5', live: true });
  });

  it('a "no" is a value that went away with no confirmation (pending non-null to null)', () => {
    const state = run([
      snapshot({ step: 'confirm_sleep', pending: { indicator: 'sleep_hours', value: 5 } }),
      snapshot({ step: 'ask_sleep' }),
    ]);

    expect(texts(state.messages)).toEqual([t('checkin.no')]);
  });

  it('after the save, Ana\'s "sí" follows the verdict and the verdict is still Vita\'s last message', () => {
    const outcome = {
      verdict: 'ok' as const,
      actionKey: '',
      actionParams: {},
      teamCriterion: false,
    };
    const state = run([
      snapshot({ step: 'summary', outcome, spoken: [] }),
      snapshot({ step: 'saved', outcome, spoken: [] }),
    ]);

    expect(texts(state.messages)).toEqual(['verdict', t('checkin.yes')]);
    expect(state.messages.filter((message) => message.kind === 'vita')).toHaveLength(0);
  });
});
