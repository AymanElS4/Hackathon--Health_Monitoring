import type { AgendaItem } from '@base-vital/contracts';

// Static demo agenda for a lunar-base day (RF10, PA2). "Lo próximo" shows the first
// item after the current time. Titles are keys into `src/config/messages.es.ts`.
// No exit-check item and no medication item (Principle VI): the EVA entry is a plain activity.

export const DEMO_AGENDA: AgendaItem[] = [
  { id: 'breakfast', time: '08:00', titleKey: 'agenda.breakfast', icon: 'meal' },
  {
    id: 'daily-checkin',
    time: '09:30',
    titleKey: 'agenda.dailyCheckin',
    durationMin: 1,
    icon: 'checkin',
    action: 'start_checkin',
  },
  {
    id: 'eva',
    time: '10:00',
    titleKey: 'agenda.eva',
    subtitleKey: 'agenda.eva.solarPanel',
    icon: 'eva',
  },
  {
    id: 'bio-experiment',
    time: '13:00',
    titleKey: 'agenda.bioExperiment',
    subtitleKey: 'agenda.bioExperiment.lab',
    icon: 'task',
  },
  { id: 'exercise', time: '18:00', titleKey: 'agenda.exercise', icon: 'exercise' },
];
