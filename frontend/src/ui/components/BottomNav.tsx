import { BookOpen, CalendarDays, HeartPulse, House, Mic, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AGENDA_PATH, GUIDE_PATH, HEALTH_PATH, HOME_PATH } from '../../config/constants';
import { t } from '../../config/messages.es';
import { SoonAction } from './SoonAction';

/** Tabs that have a screen. */
export type NavTab = 'home' | 'agenda' | 'health' | 'guide';



export interface BottomNavProps {
  active: NavTab;
  /** Starts the check-in (the raised Vita button in the center). */
  onVita: () => void;
}

interface TabDef {
  key: NavTab | 'health' | 'guide';
  labelKey: string;
  icon: LucideIcon;
}

/** Tabs left of the Vita button (Hoy · Salud). */
const LEFT_TABS: readonly TabDef[] = [
  { key: 'home', labelKey: 'nav.home', icon: House },
  { key: 'health', labelKey: 'nav.health', icon: HeartPulse },
];

/** Tabs right of the Vita button (Agenda · Guía). */
const RIGHT_TABS: readonly TabDef[] = [
  { key: 'agenda', labelKey: 'nav.agenda', icon: CalendarDays },
  { key: 'guide', labelKey: 'nav.guide', icon: BookOpen },
];

const TAB_LAYOUT = 'flex min-h-nav min-w-nav flex-1 flex-col items-center justify-center gap-xs text-meta';

/** Floating bottom dock: Hoy · Salud · (Vita) · Agenda · Guía. */
export function BottomNav({ active, onVita }: BottomNavProps) {
  const renderTab = (tab: TabDef) => {
    const Icon = tab.icon;
    const path =
      tab.key === 'home'
        ? HOME_PATH
        : tab.key === 'agenda'
          ? AGENDA_PATH
          : tab.key === 'health'
            ? HEALTH_PATH
            : tab.key === 'guide'
              ? GUIDE_PATH
              : null;

    if (path !== null) {
      if (tab.key === active) {
        return (
          <div key={tab.key} aria-current="page" className={`${TAB_LAYOUT} font-semibold text-primary`}>
            <Icon aria-hidden="true" className="h-xl w-xl" />
            <span>{t(tab.labelKey)}</span>
          </div>
        );
      }
      return (
        <Link
          key={tab.key}
          to={path}
          className={`${TAB_LAYOUT} text-ink-secondary transition-colors hover:bg-track hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
        >
          <Icon aria-hidden="true" className="h-xl w-xl" />
          <span>{t(tab.labelKey)}</span>
        </Link>
      );
    }
    return (
      <SoonAction key={tab.key} kind="button" wrapperClassName="relative flex flex-1" className={TAB_LAYOUT}>
        <Icon aria-hidden="true" className="h-xl w-xl" />
        <span>{t(tab.labelKey)}</span>
      </SoonAction>
    );
  };



  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-dock items-end rounded-t-dock bg-card px-sm pb-md pt-sm shadow-dock">
      {LEFT_TABS.map(renderTab)}
      <div className="flex flex-1 justify-center">
        <button type="button" onClick={onVita} className="group flex flex-col items-center gap-xs text-meta font-semibold text-primary">
          <span className="-mt-xl flex h-vita w-vita items-center justify-center rounded-full bg-primary text-card shadow-primary group-hover:bg-primary-hover">
            <Mic aria-hidden="true" className="h-xl w-xl" />
          </span>
          <span>{t('home.vita')}</span>
        </button>
      </div>
      {RIGHT_TABS.map(renderTab)}
    </nav>
  );
}
