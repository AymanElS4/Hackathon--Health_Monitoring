import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMO_AGENDA } from '../../config/agenda';
import { t } from '../../config/messages.es';
import { AppSidebar, BrandMark, BrandWordmark, MobileNavigation } from '../components/AppSidebar';
import { Icon } from '../components/Icon';

const HOME_UPCOMING_TIMES = new Set(['10:00', '13:00']);
const DAYS_PER_WEEK = 7;
const CALENDAR_CELL_COUNT = 42;
const MONDAY_WEEKDAY_INDEX = 1;
const WEEKDAYS = [
  'calendar.weekday.mon',
  'calendar.weekday.tue',
  'calendar.weekday.wed',
  'calendar.weekday.thu',
  'calendar.weekday.fri',
  'calendar.weekday.sat',
  'calendar.weekday.sun',
] as const;

export function Agenda() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [today] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [displayMonth, setDisplayMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const days = useMemo(() => getCalendarDays(displayMonth), [displayMonth]);
  const agendaItems = isSameDay(selectedDate, today) ? DEMO_AGENDA : [];
  const selectedDateLabel = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(selectedDate);
  const monthLabel = new Intl.DateTimeFormat('es', {
    month: 'long',
    year: 'numeric',
  }).format(displayMonth);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function changeMonth(offset: number) {
    const nextMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + offset, 1);
    setDisplayMonth(nextMonth);
    setSelectedDate(nextMonth);
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    if (date.getMonth() !== displayMonth.getMonth() || date.getFullYear() !== displayMonth.getFullYear()) {
      setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  return (
    <div className="app-shell">
      <AppSidebar activePage="agenda" />
      <main className="main-content">
        <header className="topbar">
          <Link className="mobile-brand" to="/" aria-label={t('screen.home')}>
            <BrandMark />
            <BrandWordmark />
          </Link>
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

        <div className="page-content calendar-page">
          <section className="calendar-heading">
            <div>
              <p className="eyebrow">{t('calendar.eyebrow')}</p>
              <h1>{t('screen.agenda')}</h1>
              <p>{t('calendar.description')}</p>
            </div>
            <button className="calendar-today-button" type="button" onClick={() => selectDate(today)}>
              {t('calendar.today')}
            </button>
          </section>

          <div className="calendar-layout">
            <section className="calendar-card" aria-label={t('calendar.monthView')}>
              <div className="calendar-month-heading">
                <h2>{monthLabel}</h2>
                <div className="calendar-month-actions">
                  <button
                    className="calendar-icon-button"
                    type="button"
                    aria-label={t('calendar.previousMonth')}
                    onClick={() => changeMonth(-1)}
                  >
                    <Icon name="chevron" />
                  </button>
                  <button
                    className="calendar-icon-button calendar-icon-button--next"
                    type="button"
                    aria-label={t('calendar.nextMonth')}
                    onClick={() => changeMonth(1)}
                  >
                    <Icon name="chevron" />
                  </button>
                </div>
              </div>
              <div className="calendar-grid" role="grid" aria-label={monthLabel}>
                {WEEKDAYS.map((weekday) => (
                  <div className="calendar-weekday" role="columnheader" key={weekday}>
                    {t(weekday)}
                  </div>
                ))}
                {days.map((date) => {
                  const inMonth =
                    date.getMonth() === displayMonth.getMonth() &&
                    date.getFullYear() === displayMonth.getFullYear();
                  const isToday = isSameDay(date, today);
                  const isSelected = isSameDay(date, selectedDate);
                  const hasEvents = isToday;

                  return (
                    <button
                      className={[
                        'calendar-day',
                        inMonth ? '' : 'is-outside-month',
                        isToday ? 'is-today' : '',
                        isSelected ? 'is-selected' : '',
                        hasEvents ? 'has-events' : '',
                      ].filter(Boolean).join(' ')}
                      type="button"
                      role="gridcell"
                      aria-label={formatAccessibleDate(date)}
                      aria-current={isToday ? 'date' : undefined}
                      aria-pressed={isSelected}
                      key={date.toISOString()}
                      onClick={() => selectDate(date)}
                    >
                      <span>{date.getDate()}</span>
                      {hasEvents && <span className="calendar-event-indicator" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <div className="calendar-legend">
                <span className="calendar-event-indicator" aria-hidden="true" />
                <span>{t('calendar.hasEvents')}</span>
              </div>
            </section>

            <section className="calendar-agenda-card" aria-live="polite">
              <div className="calendar-agenda-heading">
                <p className="eyebrow">{t('calendar.daySchedule')}</p>
                <h2>{selectedDateLabel}</h2>
                <p>{t('calendar.eventCount', { count: agendaItems.length })}</p>
              </div>
              {agendaItems.length === 0 ? (
                <div className="calendar-empty">
                  <span className="calendar-empty-icon"><Icon name="calendar" /></span>
                  <p>{t('calendar.empty')}</p>
                </div>
              ) : (
                <ol className="calendar-events">
                  {agendaItems.map((item, index) => {
                    const shownOnHome = HOME_UPCOMING_TIMES.has(item.time);
                    return (
                      <li
                        className={`calendar-event ${shownOnHome ? 'calendar-event--upcoming' : ''}`}
                        key={`${item.time}-${item.titleKey}`}
                      >
                        <time>{item.time}</time>
                        <span className="calendar-event-rail" aria-hidden="true">
                          <span />
                        </span>
                        <div className="calendar-event-copy">
                          <h3>{t(item.titleKey)}</h3>
                          {item.time === '10:00' && <p>{t('home.upcoming.eva')}</p>}
                          {item.time === '13:00' && <p>{t('home.upcoming.location')}</p>}
                          {shownOnHome && <span className="calendar-home-badge">{t('calendar.onHome')}</span>}
                        </div>
                        {index < agendaItems.length - 1 && <span className="calendar-event-divider" aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>

          <MobileNavigation activePage="agenda" />
        </div>
      </main>
    </div>
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getCalendarDays(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset =
    (firstOfMonth.getDay() + DAYS_PER_WEEK - MONDAY_WEEKDAY_INDEX) % DAYS_PER_WEEK;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);
  return Array.from({ length: CALENDAR_CELL_COUNT }, (_, dayOffset) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + dayOffset),
  );
}

function formatAccessibleDate(date: Date): string {
  return new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
