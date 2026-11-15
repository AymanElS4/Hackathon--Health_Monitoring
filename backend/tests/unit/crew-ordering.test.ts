import { describe, expect, it } from 'vitest';
import { orderAlerts, orderCrew } from '../../src/domain/crew-ordering';

type CrewItem = { id: string; verdict: 'ok' | 'attention' | 'alert'; completedAt: string };
type AlertItem = { id: string; urgency: 'soon' | 'now'; createdAt: string };

const crew = (id: string, verdict: CrewItem['verdict'], completedAt: string): CrewItem => ({
  id,
  verdict,
  completedAt,
});
const alert = (id: string, urgency: AlertItem['urgency'], createdAt: string): AlertItem => ({
  id,
  urgency,
  createdAt,
});

describe('orderCrew', () => {
  it('orders alert, then attention, then ok', () => {
    const result = orderCrew([
      crew('a', 'ok', '2026-11-15T08:00:00.000Z'),
      crew('b', 'alert', '2026-11-15T07:00:00.000Z'),
      crew('c', 'attention', '2026-11-15T09:00:00.000Z'),
    ]);
    expect(result.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('orders newest first within the same verdict', () => {
    const result = orderCrew([
      crew('old', 'ok', '2026-11-14T08:00:00.000Z'),
      crew('new', 'ok', '2026-11-15T08:00:00.000Z'),
      crew('mid', 'ok', '2026-11-15T01:00:00.000Z'),
    ]);
    expect(result.map((item) => item.id)).toEqual(['new', 'mid', 'old']);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = [
      crew('a', 'ok', '2026-11-14T08:00:00.000Z'),
      crew('b', 'alert', '2026-11-15T08:00:00.000Z'),
    ];
    const snapshot = [...input];
    const result = orderCrew(input);
    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
  });

  it('returns an empty array for an empty input', () => {
    expect(orderCrew([])).toEqual([]);
  });
});

describe('orderAlerts', () => {
  it('puts now before soon', () => {
    const result = orderAlerts([
      alert('soon-old', 'soon', '2026-11-10T00:00:00.000Z'),
      alert('now-new', 'now', '2026-11-15T00:00:00.000Z'),
    ]);
    expect(result.map((item) => item.id)).toEqual(['now-new', 'soon-old']);
  });

  it('orders oldest first within the same urgency', () => {
    const result = orderAlerts([
      alert('new', 'now', '2026-11-15T08:00:00.000Z'),
      alert('old', 'now', '2026-11-14T08:00:00.000Z'),
      alert('mid', 'now', '2026-11-15T01:00:00.000Z'),
    ]);
    expect(result.map((item) => item.id)).toEqual(['old', 'mid', 'new']);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = [
      alert('a', 'soon', '2026-11-14T08:00:00.000Z'),
      alert('b', 'now', '2026-11-15T08:00:00.000Z'),
    ];
    const snapshot = [...input];
    const result = orderAlerts(input);
    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
  });
});
