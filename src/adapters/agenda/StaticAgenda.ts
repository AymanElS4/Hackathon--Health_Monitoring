import type { AgendaItem } from '../../contracts';
import type { AgendaPort } from '../../application/ports';

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
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
