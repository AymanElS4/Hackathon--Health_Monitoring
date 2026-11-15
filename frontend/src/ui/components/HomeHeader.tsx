import { Moon, Wifi, WifiOff } from 'lucide-react';
import type { HomeView } from '../../application/use-cases/buildHomeView';
import { t } from '../../config/messages.es';
import { useLocale } from '../useLocale';
import { LanguageToggle } from './LanguageToggle';

export interface HomeHeaderProps {
  header: HomeView['header'];
}

/**
 * Header. Mobile (< md): row 1 (56 px) avatar + greeting + language toggle, row 2 compact chips
 * (connectivity as icon only). From md up: one line, unchanged.
 */
export function HomeHeader({ header }: HomeHeaderProps) {
  useLocale();
  const online = header.connectivity === 'online';
  const ConnectivityIcon = online ? Wifi : WifiOff;
  const phase = header.lightPhase;
  const phaseLabel = phase.kind === 'light' ? t('home.phase.light') : t('home.phase.dark');
  const connectivityText = online ? t('connectivity.online') : t('connectivity.offline');

  return (
    <header className="bg-card shadow-ambient">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-md gap-y-xs px-page py-xs md:flex-nowrap md:gap-md md:py-md">
        <img
          src={header.avatarUrl}
          alt={t('home.avatarAlt')}
          className="order-1 h-8 w-8 shrink-0 rounded-full object-cover md:order-none md:h-avatar md:w-avatar"
        />
        <h1 className="order-2 flex min-h-[56px] min-w-0 flex-1 items-center text-title font-semibold text-ink md:order-none md:block md:min-h-0">
          <span className="block min-w-0 truncate whitespace-nowrap md:overflow-visible md:whitespace-normal">
            {t('home.greeting', { name: header.crewName })}
          </span>
        </h1>
        <div className="order-4 flex w-full items-center gap-sm pb-xs md:contents">
          <p className="inline-flex h-7 shrink-0 items-center gap-xs rounded-full bg-track px-md py-0 text-meta font-semibold text-ink md:h-auto md:py-xs">
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
          <p
            aria-label={connectivityText}
            className="inline-flex h-7 shrink-0 items-center gap-xs rounded-full bg-track px-md py-0 text-meta font-semibold text-ink md:h-auto md:py-xs"
          >
            <ConnectivityIcon aria-hidden="true" className="h-lg w-lg text-primary" />
            <span className="sr-only md:not-sr-only">{connectivityText}</span>
          </p>
        </div>
        <LanguageToggle />
      </div>
    </header>
  );
}
