/**
 * Choice of the activity announced as "Lo próximo" at the end of the check-in. The check-in
 * item itself is the activity in progress, so the announcement looks past it.
 */
import type { AgendaItem } from '@base-vital/contracts';
import type { AgendaPort } from '../ports';

/** Copy of `now` set to the local `HH:mm` of `hhmm`; seconds and milliseconds are cleared. */
export function atLocalHHmm(now: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const copy = new Date(now.getTime());
  copy.setHours(hours, minutes, 0, 0);
  return copy;
}

/** First agenda item after `now` that is not the check-in item; null when the day has no more. */
export function nextAnnouncement(agenda: AgendaPort, now: Date): AgendaItem | null {
  const item = agenda.next(now);
  if (item?.action === 'start_checkin') {
    return agenda.next(atLocalHHmm(now, item.time));
  }
  return item;
}
