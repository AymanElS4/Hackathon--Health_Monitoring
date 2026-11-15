import { Moon, Wifi, WifiOff } from 'lucide-react';
import type { HomeView } from '../../application/use-cases/buildHomeView';
import { t } from '../../config/messages.es';

export interface HomeHeaderProps {
  header: HomeView['header'];
}

/** One-line header: crew avatar and greeting on the left; mission day and connectivity chips on the right. */
export function HomeHeader({ header }: HomeHeaderProps) {
  const online = header.connectivity === 'online';
  const ConnectivityIcon = online ? Wifi : WifiOff;
  const phase = header.lightPhase;
  const phaseLabel = phase.kind === 'light' ? t('home.phase.light') : t('home.phase.dark');

  return (
    <header className="bg-card shadow-ambient">
      <div className="mx-auto flex max-w-content items-center gap-md px-page py-md">
        <img
          src={header.avatarUrl}
          alt={t('home.avatarAlt')}
          className="h-avatar w-avatar shrink-0 rounded-full object-cover"
        />
        <h1 className="min-w-0 flex-1 text-title font-semibold text-ink">
          {t('home.greeting', { name: header.crewName })}
        </h1>
        <p className="inline-flex shrink-0 items-center gap-xs rounded-full bg-track px-md py-xs text-meta font-semibold text-ink">
          <Moon aria-hidden="true" className="h-lg w-lg text-primary" />
          <span>
            {t('home.missionDay', {
              day: header.missionDay,
              phase: phaseLabel,
              phaseDay: phase.day,
              phaseOf: phase.of,
            })}
          </span>
        </p>
        <p className="inline-flex shrink-0 items-center gap-xs rounded-full bg-track px-md py-xs text-meta font-semibold text-ink">
          <ConnectivityIcon aria-hidden="true" className="h-lg w-lg text-primary" />
          <span>{online ? t('connectivity.online') : t('connectivity.offline')}</span>
        </p>
      </div>
    </header>
  );
}
