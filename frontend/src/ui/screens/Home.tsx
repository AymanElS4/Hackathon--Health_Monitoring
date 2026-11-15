import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DemoScenarioId, SensorKey } from '@base-vital/contracts';
import type { CheckRepositoryPort } from '../../application/ports';
import { HOME_RANGE_PERCENT, HOME_SCENARIO_PREVIEW } from '../../config/homePreview';
import { t } from '../../config/messages.es';
import { BodyViewer } from '../body3d/BodyViewer';
import { DemoScenarioSelect } from '../components/DemoScenarioSelect';

interface HomeProps {
  scenarioId: DemoScenarioId;
  repository: CheckRepositoryPort;
  onScenarioChange: (id: DemoScenarioId) => void;
}

const SENSOR_ORDER: SensorKey[] = ['sleep', 'pulse', 'pressure', 'temperature', 'oxygen'];

function percentage(value: number, min: number, max: number): number {
  return Math.min(
    HOME_RANGE_PERCENT,
    Math.max(0, ((value - min) / (max - min)) * HOME_RANGE_PERCENT),
  );
}

export function Home({ scenarioId, repository, onScenarioChange }: HomeProps) {
  const [selectedSensor, setSelectedSensor] = useState<SensorKey | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const preview = HOME_SCENARIO_PREVIEW[scenarioId];
  const metrics = [...preview.metrics].sort(
    (first, second) =>
      SENSOR_ORDER.indexOf(first.sensor) - SENSOR_ORDER.indexOf(second.sensor),
  );
  const statusText = preview.verdict
    ? t('home.status.today', {
        verdict:
          preview.verdict === 'ok'
              ? t('home.status.ok')
            : t(`verdict.${preview.verdict}`),
      })
    : t('home.status.none');

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label={t('screen.home')}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <path d="M20 5v30M5 20h30M9.4 9.4l21.2 21.2m0-21.2L9.4 30.6" />
              <circle cx="20" cy="20" r="7" />
            </svg>
          </span>
          <span className="brand-wordmark">{t('home.brandBase')}<span>{t('home.brandVital')}</span></span>
        </Link>

        <div className="sidebar-label">{t('home.todayLabel')}</div>
        <nav className="side-nav" aria-label={t('home.todayLabel')}>
          <Link
            className="side-nav-item is-active"
            to="/"
            aria-current="page"
            aria-label={t('home.nav.home')}
          >
            <Icon name="home" />
            <span>{t('home.nav.home')}</span>
            <span className="nav-active-mark" />
          </Link>
          <DisabledNavItem name="health" icon="health" />
          <DisabledNavItem name="agenda" icon="calendar" />
          <DisabledNavItem name="guide" icon="guide" />
        </nav>

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

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 40 40">
                <path d="M20 5v30M5 20h30M9.4 9.4l21.2 21.2m0-21.2L9.4 30.6" />
                <circle cx="20" cy="20" r="7" />
              </svg>
            </span>
            <span className="brand-wordmark">{t('home.brandBase')}<span>{t('home.brandVital')}</span></span>
          </div>
          <div className="topbar-status">
            <span className={`connection-dot ${online ? 'is-online' : 'is-offline'}`} />
            <span>{online ? t('home.connectivity.online') : t('home.connectivity.offline')}</span>
          </div>
          <div className="topbar-profile">
            <div className="avatar" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <circle cx="24" cy="17" r="8" />
                <path d="M8 43c1.7-9.2 7.3-14 16-14s14.3 4.8 16 14" />
              </svg>
            </div>
            <div className="profile-copy">
              <strong>{t('home.crewName')}</strong>
              <span>{t('home.missionDay')}</span>
            </div>
            <span className="profile-chevron"><Icon name="chevron" /></span>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{t('home.dashboardTitle')}</p>
              <h1>{t('home.greeting', { name: t('home.crewName') })}<span className="greeting-sparkle" aria-hidden="true">{t('home.greetingGlyph')}</span></h1>
              <p className="welcome-subtitle">{t('home.demoDisclaimer')}</p>
            </div>
            <div className="scenario-panel">
              <DemoScenarioSelect
                currentId={scenarioId}
                repository={repository}
                onChanged={onScenarioChange}
              />
            </div>
          </section>

          <section className="schedule-grid" aria-label={t('home.dashboardTitle')}>
            <article className="schedule-card now-card">
              <div className="card-kicker">
                <span className="card-icon card-icon--blue"><Icon name="sun" /></span>
                <span>{t('home.now')}</span>
                <span className="live-pill"><span />{t('home.todayLabel')}</span>
              </div>
              <div className="now-card-body">
                <div>
                  <h2>{t('home.checkinTitle')}</h2>
                  <p>{t('home.checkinDescription')}</p>
                  <div className="schedule-meta">
                    <span><Icon name="clock" />{t('home.checkinTime')}</span>
                    <span className="meta-divider" />
                    <span>{t('home.duration')}</span>
                  </div>
                </div>
                <div className="schedule-action-orbit" aria-hidden="true">
                  <Icon name="spark" />
                </div>
              </div>
              <div className="now-card-bottom">
                <div className="progress-copy">
                  <span>{t('home.progress')}</span>
                  <strong>{t('home.progressValue')}</strong>
                </div>
                <div className="day-progress" aria-hidden="true"><span /></div>
                <Link className="primary-button" to="/checkin">
                  {t('home.start')}<Icon name="arrow" />
                </Link>
              </div>
            </article>

            <article className="schedule-card next-card">
              <div className="card-kicker">
                <span className="card-icon card-icon--lavender"><Icon name="calendar" /></span>
                <span>{t('home.next')}</span>
                <span className="pending-count">{t('home.nextCount')}</span>
              </div>
              <div className="upcoming-list">
                <UpcomingItem
                  time="10:00"
                  title={t('agenda.maintenance')}
                  subtitle={t('home.upcoming.eva')}
                  icon="orbit"
                  color="mint"
                />
                <div className="upcoming-separator" />
                <UpcomingItem
                  time="13:00"
                  title={t('agenda.experiment')}
                  subtitle={t('home.upcoming.location')}
                  icon="flask"
                  color="peach"
                />
              </div>
              <p className="pending-note">{t('home.pending', { count: 2 })}</p>
            </article>
          </section>

          <section className="status-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('home.todayLabel')}</p>
                <h2>{t('home.status.title', { name: t('home.crewName') })}</h2>
              </div>
              <div className="status-chips">
                <span className={`verdict-chip verdict-chip--${preview.verdict ?? 'unknown'}`}>
                  <span className="verdict-indicator" />
                  {statusText}
                </span>
                {preview.mood !== null && (
                  <span className="mood-chip">{t('home.mood', { value: preview.mood })}</span>
                )}
              </div>
            </div>

            <div className="health-card">
              <div className="body-panel">
                <div className="body-panel-heading">
                  <div>
                    <h3>{t('home.bodyLabel')}</h3>
                    <p>{t('home.sensorHint')}</p>
                  </div>
                  <span className="demo-tag"><span />{t('home.demoLabel')}</span>
                </div>
                <div className="body-illustration">
                  <BodyViewer
                    metrics={metrics}
                    selectedSensor={selectedSensor}
                    onSensorTap={setSelectedSensor}
                  />
                  <div className="body-figure-caption">{t('home.reading.simulated')}</div>
                </div>
                <div className="body-legend">
                  {SENSOR_ORDER.map((sensor) => (
                    <button
                      className={`legend-item ${selectedSensor === sensor ? 'is-selected' : ''}`}
                      key={sensor}
                      type="button"
                      onClick={() => setSelectedSensor(sensor)}
                    >
                      <span className={`legend-dot legend-dot--${sensor}`} />
                      {t(`home.metric.${sensor}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="metrics-panel">
                <div className="metrics-heading">
                  <div>
                    <h3>{t('home.selectedMetric')}</h3>
                    <p>{t('home.reading.simulated')}</p>
                  </div>
                  <span className="metrics-menu" aria-hidden="true"><Icon name="more" /></span>
                </div>
                <div className="metric-list">
                  {metrics.map((item) => (
                    <MetricRow
                      item={item}
                      key={item.sensor}
                      selected={selectedSensor === item.sensor}
                      onSelect={() => setSelectedSensor(item.sensor)}
                    />
                  ))}
                </div>
                <div className="metric-footnote">
                  <span className="baseline-icon" aria-hidden="true"><Icon name="trend" /></span>
                  <span>{t('home.baseline')}</span>
                  <span className="footnote-divider" />
                  <span>{t('home.metricNote')}</span>
                </div>
              </div>
            </div>
          </section>

          <footer className="page-footer">
            <span>{t('home.demoDisclaimer')}</span>
            <span><span className="footer-dot" />{t('home.source.simulated')}</span>
          </footer>
          <nav className="mobile-bottom-nav" aria-label={t('home.todayLabel')}>
            <Link className="mobile-nav-item is-active" to="/" aria-label={t('home.nav.home')}>
              <Icon name="home" /><span>{t('home.nav.home')}</span>
            </Link>
            <MobileDisabledNavItem name="health" icon="health" />
            <MobileDisabledNavItem name="agenda" icon="calendar" />
            <MobileDisabledNavItem name="guide" icon="guide" />
            <Link className="mobile-nav-item" to="/historial" aria-label={t('home.nav.history')}>
              <Icon name="history" /><span>{t('home.nav.history')}</span>
            </Link>
          </nav>
        </div>
      </main>
    </div>
  );
}

interface MetricRowProps {
  item: (typeof HOME_SCENARIO_PREVIEW)[DemoScenarioId]['metrics'][number];
  selected: boolean;
  onSelect: () => void;
}

function MetricRow({ item, selected, onSelect }: MetricRowProps) {
  const label = t(`home.metric.${item.sensor}`);
  const value =
    item.value === '—' || item.sensor === 'pressure'
      ? item.value
      : t('home.metricValue', {
          value: item.value,
          unit: t(`home.unit.${item.sensor}`),
        });
  const statusLabel = t(`level.${item.level}`);
  const marker = item.marker === null ? null : percentage(item.marker, item.min, item.max);
  const allowedLeft = percentage(item.allowedStart, item.min, item.max);
  const allowedWidth = percentage(item.allowedEnd, item.min, item.max) - allowedLeft;
  const markerStyle = marker === null ? undefined : ({ left: `${marker}%` } as CSSProperties);
  const allowedStyle = {
    left: `${allowedLeft}%`,
    width: `${allowedWidth}%`,
  } as CSSProperties;

  return (
    <button
      className={`metric-row ${selected ? 'is-selected' : ''}`}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={`metric-sensor-icon metric-sensor-icon--${item.sensor}`}>
        <Icon name={item.sensor} />
      </span>
      <span className="metric-main">
        <span className="metric-title-line">
          <strong>{label}</strong>
          <span className={`level-badge level-badge--${item.level}`}>
            <span />{statusLabel}
          </span>
        </span>
        <span className="range-track" aria-hidden="true">
          <span className="range-allowed" style={allowedStyle} />
          {markerStyle && <span className="range-marker" style={markerStyle} />}
        </span>
        <span className="range-endpoints">
          <span>{item.min}</span>
          <span className="allowed-range-label">{t(`home.allowed.${item.sensor}`)}</span>
          <span>{item.max}</span>
        </span>
      </span>
      <span className="metric-value">
        <strong>{value}</strong>
        <span>
          {t(item.sensor === 'sleep' ? 'home.source.voice' : 'home.source.simulated')}
        </span>
      </span>
    </button>
  );
}

interface UpcomingItemProps {
  time: string;
  title: string;
  subtitle: string;
  icon: 'orbit' | 'flask';
  color: 'mint' | 'peach';
}

function UpcomingItem({ time, title, subtitle, icon, color }: UpcomingItemProps) {
  return (
    <div className="upcoming-item">
      <span className="upcoming-time">{time}</span>
      <span className={`upcoming-icon upcoming-icon--${color}`}><Icon name={icon} /></span>
      <span className="upcoming-copy"><strong>{title}</strong><span>{subtitle}</span></span>
      <span className="upcoming-arrow"><Icon name="arrow" /></span>
    </div>
  );
}

function DisabledNavItem({ name, icon }: { name: 'health' | 'agenda' | 'guide'; icon: 'health' | 'calendar' | 'guide' }) {
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

function MobileDisabledNavItem({ name, icon }: { name: 'health' | 'agenda' | 'guide'; icon: 'health' | 'calendar' | 'guide' }) {
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

function Icon({ name }: { name: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    health: <><path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" /><path d="M5 12h4l2-3 3 6 2-3h3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    guide: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22Z" /><path d="M4 5.5V22m4-15h8m-8 4h8" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    orbit: <><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-32 12 12)" /><circle cx="4" cy="17" r="1" fill="currentColor" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    spark: <><path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
    pulse: <><path d="M3 12h4l3-7 4 14 3-7h4" /></>,
    pressure: <><path d="M4 15a8 8 0 1 1 16 0v3H4Z" /><path d="m12 13 3-4m-9 9h12" /></>,
    oxygen: <><path d="M12 21s7-4.4 7-11a4 4 0 0 0-7-2.6A4 4 0 0 0 5 10c0 6.6 7 11 7 11Z" /><path d="M8 12h2l1-2 2 4 1-2h2" /></>,
    temperature: <><path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z" /><path d="M11 11v6" /></>,
    sleep: <><path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z" /><path d="M16 3v4m-2-2h4" /></>,
    flask: <><path d="M9 3h6m-5 0v6l-5.8 9.2A2 2 0 0 0 6.9 21h10.2a2 2 0 0 0 1.7-2.8L13 9V3" /><path d="M8 15h8" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
    trend: <><path d="m3 16 6-6 4 4 8-9" /><path d="M15 5h6v6" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>{paths[name] ?? paths.spark}</svg>;
}
