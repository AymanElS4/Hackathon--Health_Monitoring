import { ArrowRight, Clock, Dumbbell, FlaskConical, HeartPulse, Rocket, Utensils, type LucideIcon } from 'lucide-react';
import type { AgendaIcon } from '@base-vital/contracts';
import type { HomeView } from '../../application/use-cases/buildHomeView';
import { NEXT_MAX } from '../../config/constants';
import { t } from '../../config/messages.es';
import { Card } from './Card';
import { CardHeader } from './CardHeader';
import { SoonAction } from './SoonAction';

export interface NextListProps {
  next: HomeView['next'];
  pendingToday: number;
}

/** Icon per agenda icon key. */
const NEXT_ICONS: Record<AgendaIcon, LucideIcon> = {
  checkin: HeartPulse,
  eva: Rocket,
  meal: Utensils,
  exercise: Dumbbell,
  task: FlaskConical,
};

/** Upcoming activities ("Después") with the pending count for today in the footer. Shows at most `NEXT_MAX` rows. */
export function NextList({ next, pendingToday }: NextListProps) {
  const rows = next.slice(0, NEXT_MAX);

  return (
    <Card className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-md">
        <CardHeader
          label={t('home.next')}
          trailing={
            <SoonAction kind="link" className="inline-flex items-center gap-xs text-small font-semibold">
              {t('nav.agenda')}
              <ArrowRight aria-hidden="true" className="h-lg w-lg" />
            </SoonAction>
          }
        />
        <ul className="flex flex-col gap-sm">
          {rows.map((item) => {
            const Icon = item.icon !== undefined ? NEXT_ICONS[item.icon] : Clock;
            return (
              <li key={item.id} className="flex min-h-touch items-center gap-md rounded-row bg-canvas p-md">
                <span className="flex h-iconCircle w-iconCircle shrink-0 items-center justify-center rounded-full bg-track">
                  <Icon aria-hidden="true" className="h-xl w-xl text-primary" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-rowTitle font-semibold text-ink">{t(item.titleKey)}</p>
                  {item.subtitleKey !== undefined && (
                    <p className="text-rowSub text-ink-secondary">{t(item.subtitleKey)}</p>
                  )}
                </div>
                <span className="shrink-0 text-rowTitle font-bold text-ink">{item.time}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-auto border-t border-track pt-md text-center text-meta text-ink-secondary">
          {pendingToday === 1 ? t('home.pending.one') : t('home.pending', { n: pendingToday })}
        </p>
      </div>
    </Card>
  );
}
