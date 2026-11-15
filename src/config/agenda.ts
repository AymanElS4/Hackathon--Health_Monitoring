import type { AgendaItem } from '../contracts';

// Static demo agenda for a lunar-base day (RF10, PA2). "Lo próximo" shows the first
// item after the current time. Titles are keys into `src/config/messages.es.ts`.
// No exit-check or EVA item: out of scope for this prototype.

export const DEMO_AGENDA: AgendaItem[] = [
  { time: '07:30', titleKey: 'agenda.daily_check' },
  { time: '08:30', titleKey: 'agenda.breakfast' },
  { time: '10:00', titleKey: 'agenda.maintenance' },
  { time: '13:00', titleKey: 'agenda.lunch' },
  { time: '15:00', titleKey: 'agenda.experiment' },
  { time: '18:00', titleKey: 'agenda.exercise' },
];
