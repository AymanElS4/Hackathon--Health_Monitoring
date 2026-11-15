import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { DemoScenarioId, SensorKey } from '@base-vital/contracts';
import type { CheckRepositoryPort } from '../../application/ports';
import { HOME_RANGE_PERCENT, HOME_SCENARIO_PREVIEW } from '../../config/homePreview';
import { t } from '../../config/messages.es';
import { AppSidebar, MobileNavigation } from '../components/AppSidebar';
import { BodyViewer } from '../body3d/BodyViewer';
import { DemoScenarioSelect } from '../components/DemoScenarioSelect';
import { Icon } from '../components/Icon';

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
      <AppSidebar activePage="home" />

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
          <MobileNavigation activePage="home" />
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
