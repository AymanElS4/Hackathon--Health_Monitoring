import { Link } from 'react-router-dom';
import { t } from '../../config/messages.es';
import { Icon } from './Icon';

type ActivePage = 'home' | 'agenda';

export function AppSidebar({ activePage }: { activePage: ActivePage }) {
  return (
    <aside className="sidebar">
      <Link className="brand" to="/" aria-label={t('screen.home')}>
        <BrandMark />
        <BrandWordmark />
      </Link>

      <div className="sidebar-label">{t('home.todayLabel')}</div>
      <PrimaryNavigation activePage={activePage} />

      <div className="sidebar-spacer" />
      <div className="mission-brief">
        <div className="mission-orbit" aria-hidden="true">
          <Icon name="moon" />
        </div>
        <p className="mission-brief-kicker">{t('home.afterMission')}</p>
        <p className="mission-brief-title">{t('home.lunarCycle')}</p>
        <div className="mission-progress" aria-hidden="true"><span /></div>
        <p className="mission-brief-caption">{t('home.phaseValue')}</p>
      </div>
      <Link className="side-nav-item history-link" to="/historial" aria-label={t('home.nav.history')}>
        <Icon name="history" />
        <span>{t('home.nav.history')}</span>
        <Icon name="chevron" />
      </Link>
      <div className="sidebar-footer">
        <span className="footer-orbit" aria-hidden="true"><Icon name="orbit" /></span>
        <span>{t('home.demoLabel')}</span>
        <span className="footer-dot" />
      </div>
    </aside>
  );
}

export function MobileNavigation({ activePage }: { activePage: ActivePage }) {
  return (
    <nav className="mobile-bottom-nav" aria-label={t('home.todayLabel')}>
      <Link
        className={`mobile-nav-item ${activePage === 'home' ? 'is-active' : ''}`}
        to="/"
        aria-label={t('home.nav.home')}
        aria-current={activePage === 'home' ? 'page' : undefined}
      >
        <Icon name="home" /><span>{t('home.nav.home')}</span>
      </Link>
      <MobileDisabledNavItem name="health" icon="health" />
      <Link
        className={`mobile-nav-item ${activePage === 'agenda' ? 'is-active' : ''}`}
        to="/agenda"
        aria-label={t('home.nav.agenda')}
        aria-current={activePage === 'agenda' ? 'page' : undefined}
      >
        <Icon name="calendar" /><span>{t('home.nav.agenda')}</span>
      </Link>
      <MobileDisabledNavItem name="guide" icon="guide" />
      <Link className="mobile-nav-item" to="/historial" aria-label={t('home.nav.history')}>
        <Icon name="history" /><span>{t('home.nav.history')}</span>
      </Link>
    </nav>
  );
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <path d="M20 5v30M5 20h30M9.4 9.4l21.2 21.2m0-21.2L9.4 30.6" />
        <circle cx="20" cy="20" r="7" />
      </svg>
    </span>
  );
}

export function BrandWordmark() {
  return <span className="brand-wordmark">{t('home.brandBase')}<span>{t('home.brandVital')}</span></span>;
}

function PrimaryNavigation({ activePage }: { activePage: ActivePage }) {
  return (
    <nav className="side-nav" aria-label={t('home.todayLabel')}>
      <Link
        className={`side-nav-item ${activePage === 'home' ? 'is-active' : ''}`}
        to="/"
        aria-current={activePage === 'home' ? 'page' : undefined}
        aria-label={t('home.nav.home')}
      >
        <Icon name="home" />
        <span>{t('home.nav.home')}</span>
        {activePage === 'home' && <span className="nav-active-mark" />}
      </Link>
      <DisabledNavItem name="health" icon="health" />
      <Link
        className={`side-nav-item ${activePage === 'agenda' ? 'is-active' : ''}`}
        to="/agenda"
        aria-current={activePage === 'agenda' ? 'page' : undefined}
        aria-label={t('home.nav.agenda')}
      >
        <Icon name="calendar" />
        <span>{t('home.nav.agenda')}</span>
        {activePage === 'agenda' && <span className="nav-active-mark" />}
      </Link>
      <DisabledNavItem name="guide" icon="guide" />
    </nav>
  );
}

function DisabledNavItem({ name, icon }: { name: 'health' | 'guide'; icon: 'health' | 'guide' }) {
  return (
    <button
      className="side-nav-item is-disabled"
      type="button"
      disabled
      title={t('home.comingSoon')}
      aria-label={t('home.nav.disabled', {
        name: t(`home.nav.${name}`),
        status: t('home.comingSoon'),
      })}
    >
      <Icon name={icon} />
      <span>{t(`home.nav.${name}`)}</span>
      <span className="soon-dot">{t('home.comingSoon')}</span>
    </button>
  );
}

function MobileDisabledNavItem({ name, icon }: { name: 'health' | 'guide'; icon: 'health' | 'guide' }) {
  return (
    <button
      className="mobile-nav-item is-disabled"
      type="button"
      disabled
      aria-label={t('home.nav.disabled', {
        name: t(`home.nav.${name}`),
        status: t('home.comingSoon'),
      })}
    >
      <Icon name={icon} /><span>{t(`home.nav.${name}`)}</span>
    </button>
  );
}
