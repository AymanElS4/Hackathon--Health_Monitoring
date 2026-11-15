import { describe, it, expect } from 'vitest';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { AgendaItem } from '@base-vital/contracts';
import { messages } from '../../src/config/messages.es';

const at = (hh: number, mm: number) => new Date(2026, 10, 15, hh, mm);

const BREAKFAST = DEMO_AGENDA.find((item) => item.id === 'breakfast');
const DAILY_CHECKIN = DEMO_AGENDA.find((item) => item.id === 'daily-checkin');
const EVA = DEMO_AGENDA.find((item) => item.id === 'eva');
const BIO_EXPERIMENT = DEMO_AGENDA.find((item) => item.id === 'bio-experiment');

// Words that must never appear in the demo day (Principle VI: no medication).
const MEDICATION_WORDS = /vitamina|dosis|medicamento|pastilla/i;

describe('StaticAgenda', () => {
  const agenda = new StaticAgenda(DEMO_AGENDA);

  it('returns the first item when now is before it', () => {
    expect(agenda.next(at(6, 0))).toEqual(BREAKFAST);
    expect(agenda.next(at(0, 0))).toEqual(BREAKFAST);
  });

  it('returns the next item between two items', () => {
    expect(agenda.next(at(9, 0))).toEqual(DAILY_CHECKIN);
    expect(agenda.next(at(9, 45))).toEqual(EVA);
    expect(agenda.next(at(11, 0))).toEqual(BIO_EXPERIMENT);
  });

  it('returns the item strictly after the current minute', () => {
    expect(agenda.next(at(8, 0))).toEqual(DAILY_CHECKIN);
    expect(agenda.next(at(7, 59))).toEqual(BREAKFAST);
    expect(agenda.next(at(9, 30))).toEqual(EVA);
    expect(agenda.next(at(9, 29))).toEqual(DAILY_CHECKIN);
  });

  it('returns null after the last item', () => {
    expect(agenda.next(at(18, 0))).toBeNull();
    expect(agenda.next(at(23, 59))).toBeNull();
  });

  it('sorts unordered items before searching', () => {
    const shuffled = new StaticAgenda([DEMO_AGENDA[2], DEMO_AGENDA[0], DEMO_AGENDA[1]]);
    expect(shuffled.next(at(7, 0))).toEqual(BREAKFAST);
    expect(shuffled.next(at(8, 0))).toEqual(DAILY_CHECKIN);
    expect(shuffled.next(at(9, 30))).toEqual(EVA);
  });

  it('demo agenda has valid items, a daily check-in, and a message for every key', () => {
    for (const item of DEMO_AGENDA) {
      expect(AgendaItem.safeParse(item).success).toBe(true);
      expect(messages[item.titleKey], `missing message: ${item.titleKey}`).toBeTruthy();
      if (item.subtitleKey) {
        expect(messages[item.subtitleKey], `missing message: ${item.subtitleKey}`).toBeTruthy();
      }
    }
  });

  it('daily-checkin item has action start_checkin and durationMin 1', () => {
    expect(DAILY_CHECKIN?.time).toBe('09:30');
    expect(DAILY_CHECKIN?.action).toBe('start_checkin');
    expect(DAILY_CHECKIN?.durationMin).toBe(1);
  });

  it('no item title or subtitle mentions medication', () => {
    for (const item of DEMO_AGENDA) {
      const texts = [messages[item.titleKey], item.subtitleKey ? messages[item.subtitleKey] : '']
        .filter(Boolean)
        .join(' ');
      expect(texts, `medication wording in ${item.id}`).not.toMatch(MEDICATION_WORDS);
    }
  });
});

describe('FixedClock', () => {
  it('returns its date', () => {
    const date = new Date(2026, 10, 15, 9, 15);
    const clock = new FixedClock(date);
    expect(clock.now()).toEqual(date);
  });
});
