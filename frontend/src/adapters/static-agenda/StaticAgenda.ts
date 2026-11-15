import type { AgendaItem } from '@base-vital/contracts';
import type { AgendaPort } from '../../application/ports';

/** Digits per clock field in `HH:mm`. */
const CLOCK_FIELD_WIDTH = 2;

/**
 * Agenda backed by a fixed list of items (demo day in `src/config/agenda.ts`).
 * Compares `HH:mm` strings in local time.
 */
export class StaticAgenda implements AgendaPort {
  private readonly items: AgendaItem[];

  constructor(items: readonly AgendaItem[]) {
    this.items = [...items].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }

  /** First item whose time is strictly after `now`'s local HH:mm, or null. */
  next(now: Date): AgendaItem | null {
    const current = formatHHmm(now);
    return this.items.find((item) => item.time > current) ?? null;
  }
}

function formatHHmm(date: Date): string {
  const hh = String(date.getHours()).padStart(CLOCK_FIELD_WIDTH, '0');
  const mm = String(date.getMinutes()).padStart(CLOCK_FIELD_WIDTH, '0');
  return `${hh}:${mm}`;
}
