import { Clock, Play } from 'lucide-react';
import type { HomeView } from '../../application/use-cases/buildHomeView';
import { t } from '../../config/messages.es';
import { Button } from './Button';
import { Card } from './Card';
import { CardHeader } from './CardHeader';

export interface NowCardProps {
  now: NonNullable<HomeView['now']>;
  onStart: () => void;
}

/** The current agenda activity: header with time chip, title, progress and footer (estimate + "Empezar"). */
export function NowCard({ now, onStart }: NowCardProps) {
  const { done, total } = now.progress;
  const fraction = total === 0 ? 0 : done / total;
  const timeLabel =
    now.durationMin !== undefined ? t('home.timeChip', { time: now.time, min: now.durationMin }) : now.time;

  return (
    <Card className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-md">
        <CardHeader
          label={t('home.now')}
          trailing={
            <span className="inline-flex items-center gap-xs rounded-full bg-track px-md py-xs text-meta font-semibold text-ink">
              <Clock aria-hidden="true" className="h-lg w-lg text-primary" />
              <span>{timeLabel}</span>
            </span>
          }
        />
        <p className="text-heading font-bold text-ink">{t(now.titleKey)}</p>
        <div className="flex flex-col gap-xs">
          <p className="text-meta text-ink-secondary">{t('home.progress', { done, total })}</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-valuetext={t('home.progress', { done, total })}
            className="h-progressBar overflow-hidden rounded-card bg-track"
          >
            <div className="h-full origin-left bg-primary" style={{ transform: `scaleX(${fraction})` }} />
          </div>
        </div>
        <footer className="mt-auto flex items-center justify-between gap-md border-t border-track pt-md">
          {now.durationMin !== undefined ? (
            <p className="text-meta text-ink-secondary">{t('home.estimated', { min: now.durationMin })}</p>
          ) : (
            <span />
          )}
          <Button onClick={onStart} shape="pill">
            <span className="inline-flex items-center gap-sm">
              {t('home.start')}
              <Play aria-hidden="true" className="h-lg w-lg" />
            </span>
          </Button>
        </footer>
      </div>
    </Card>
  );
}
