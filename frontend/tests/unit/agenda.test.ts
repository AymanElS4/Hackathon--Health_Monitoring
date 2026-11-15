import { describe, it, expect } from 'vitest';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { AgendaItem } from '@base-vital/contracts';
import { messages } from '../../src/config/messages.es';

const at = (hh: number, mm: number) => new Date(2026, 10, 15, hh, mm);

describe('StaticAgenda', () => {
  const agenda = new StaticAgenda(DEMO_AGENDA);

  it('returns the first item when now is before it', () => {
    expect(agenda.next(at(6, 0))).toEqual(DEMO_AGENDA[0]);
    expect(agenda.next(at(0, 0))).toEqual({ time: '07:30', titleKey: 'agenda.daily_check' });
  });

  it('returns the next item between two items', () => {
    expect(agenda.next(at(9, 0))).toEqual({ time: '10:00', titleKey: 'agenda.maintenance' });
  });

  it('returns the item strictly after the current minute', () => {
    expect(agenda.next(at(7, 30))).toEqual({ time: '08:30', titleKey: 'agenda.breakfast' });
    expect(agenda.next(at(7, 29))).toEqual({ time: '07:30', titleKey: 'agenda.daily_check' });
  });

  it('returns null after the last item', () => {
    expect(agenda.next(at(18, 0))).toBeNull();
    expect(agenda.next(at(23, 59))).toBeNull();
  });

  it('sorts unordered items before searching', () => {
    const shuffled = new StaticAgenda([DEMO_AGENDA[2], DEMO_AGENDA[0], DEMO_AGENDA[1]]);
    expect(shuffled.next(at(8, 0))).toEqual({ time: '08:30', titleKey: 'agenda.breakfast' });
    expect(shuffled.next(at(9, 0))).toEqual({ time: '10:00', titleKey: 'agenda.maintenance' });
  });

  it('demo agenda has a Chequeo diario item, no exit check, and valid items with messages', () => {
    const daily = DEMO_AGENDA.find((item) => item.titleKey === 'agenda.daily_check');
    expect(daily?.time).toBe('07:30');
    for (const item of DEMO_AGENDA) {
      expect(AgendaItem.safeParse(item).success).toBe(true);
      expect(messages[item.titleKey], `missing message: ${item.titleKey}`).toBeTruthy();
      expect(item.titleKey).not.toMatch(/exit|salida|eva/i);
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
