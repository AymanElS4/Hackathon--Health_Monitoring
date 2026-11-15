import type { AgendaItem } from '@base-vital/contracts';

export interface AgendaPort {
  next(now: Date): AgendaItem | null;
}
