import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useHistory } from 'react-router-dom';
import { DEMO_AGENDA } from '../../config/agenda';
import { CHECKIN_PATH, HOME_PATH } from '../../config/constants';
import { t } from '../../config/messages.es';
import { useAppServices } from '../AppServices';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';

const DAYS_PER_WEEK = 7;
const CALENDAR_CELL_COUNT = 42;
const MONDAY_WEEKDAY_INDEX = 1;
const DATE_PART_WIDTH = 2;
const WEEKDAYS = [
  'calendar.weekday.mon',
  'calendar.weekday.tue',
  'calendar.weekday.wed',
  'calendar.weekday.thu',
  'calendar.weekday.fri',
  'calendar.weekday.sat',
  'calendar.weekday.sun',
] as const;

const MONTH_FORMAT = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
const DATE_FORMAT = new Intl.DateTimeFormat('es', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getCalendarDays(month: Date): Date[] {
  const firstOfMonth = startOfMonth(month);
  const mondayOffset = (firstOfMonth.getDay() + DAYS_PER_WEEK - MONDAY_WEEKDAY_INDEX) % DAYS_PER_WEEK;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);
  return Array.from(
    { length: CALENDAR_CELL_COUNT },
    (_, dayOffset) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + dayOffset),
  );
}

function formatLocalDateTime(date: Date, time: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(DATE_PART_WIDTH, '0');
  const day = String(date.getDate()).padStart(DATE_PART_WIDTH, '0');
  return `${year}-${month}-${day}T${time}`;
}

/** Monthly calendar and the activities for its selected date. */
export function Agenda() {
  const container = useAppServices();
  const history = useHistory();
  const [today] = useState(() => startOfDay(container.clock.now()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(today));
  const days = useMemo(() => getCalendarDays(displayMonth), [displayMonth]);
  const agendaItems = isSameDay(selectedDate, today) ? DEMO_AGENDA : [];
  const selectedDateLabel = DATE_FORMAT.format(selectedDate);
  const monthLabel = MONTH_FORMAT.format(displayMonth);
  const eventCountLabel =
    agendaItems.length === 1
      ? t('calendar.eventCount.one')
      : t('calendar.eventCount.other', { n: agendaItems.length });

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    if (date.getMonth() !== displayMonth.getMonth() || date.getFullYear() !== displayMonth.getFullYear()) {
      setDisplayMonth(startOfMonth(date));
    }
  };

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + offset, 1);
    setDisplayMonth(nextMonth);
    setSelectedDate(nextMonth);
  };

  const returnToToday = () => {
    setDisplayMonth(startOfMonth(today));
    setSelectedDate(today);
  };

  const startCheckin = () => {
    history.push({ pathname: CHECKIN_PATH, state: { autostart: true } });
  };

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-card shadow-ambient">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-md px-page py-md">
          <div className="flex min-w-0 flex-col gap-xs">
            <Link to={HOME_PATH} className="inline-flex items-center gap-xs text-meta font-semibold text-primary">
              <ArrowLeft aria-hidden="true" className="h-lg w-lg" />
              {t('calendar.backHome')}
            </Link>
            <h1 className="text-title font-semibold text-ink">{t('screen.agenda')}</h1>
          </div>
          <button
            type="button"
            onClick={returnToToday}
            className="min-h-touch rounded-card bg-primary px-lg text-small font-semibold text-card hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            {t('calendar.today')}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-content flex-col gap-xl px-page pb-dockClearance pt-xl">
        <div className="grid grid-cols-1 gap-xl md:grid-cols-7">
          <Card className="flex flex-col gap-md md:col-span-4">
            <div className="flex items-center justify-between gap-md">
              <div>
                <p className="text-meta font-semibold text-primary">{t('calendar.eyebrow')}</p>
                <h2 className="text-title font-semibold capitalize text-ink">{monthLabel}</h2>
              </div>
              <div className="flex gap-xs">
                <button
                  type="button"
                  aria-label={t('calendar.previousMonth')}
                  onClick={() => changeMonth(-1)}
                  className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-primary hover:bg-track focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <ChevronLeft aria-hidden="true" className="h-xl w-xl" />
                </button>
                <button
                  type="button"
                  aria-label={t('calendar.nextMonth')}
                  onClick={() => changeMonth(1)}
                  className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-primary hover:bg-track focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <ChevronRight aria-hidden="true" className="h-xl w-xl" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-xs" role="group" aria-label={monthLabel}>
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  aria-hidden="true"
                  className="py-xs text-center text-meta font-semibold text-ink-secondary"
                >
                  {t(weekday)}
                </div>
              ))}
              {days.map((date) => {
                const inMonth =
                  date.getMonth() === displayMonth.getMonth() && date.getFullYear() === displayMonth.getFullYear();
                const isToday = isSameDay(date, today);
                const isSelected = isSameDay(date, selectedDate);
                const hasEvents = isToday;

                return (
                  <button
                    key={date.getTime()}
                    type="button"
                    aria-label={DATE_FORMAT.format(date)}
                    aria-current={isToday ? 'date' : undefined}
                    aria-pressed={isSelected}
                    onClick={() => selectDate(date)}
                    className={[
                      'flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-full text-small transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                      isSelected
                        ? 'bg-primary font-semibold text-card hover:bg-primary-hover'
                        : isToday
                          ? 'font-semibold text-primary ring-1 ring-primary'
                          : 'text-ink hover:bg-track',
                      inMonth ? '' : 'opacity-40',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span>{date.getDate()}</span>
                    {hasEvents && (
                      <span
                        aria-hidden="true"
                        className={`h-1 w-1 rounded-full ${isSelected ? 'bg-card' : 'bg-primary'}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <p className="flex items-center gap-sm text-meta text-ink-secondary">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
              {t('calendar.hasEvents')}
            </p>
          </Card>

          <Card className="flex flex-col gap-md md:col-span-3">
            <div aria-live="polite" className="border-b border-track pb-md">
              <p className="text-meta font-semibold text-primary">{t('calendar.daySchedule')}</p>
              <h2 className="mt-xs text-title font-semibold capitalize text-ink">{selectedDateLabel}</h2>
              <p className="mt-xs text-meta text-ink-secondary">{eventCountLabel}</p>
            </div>
            {agendaItems.length === 0 ? (
              <p className="py-xl text-center text-body text-ink-secondary">{t('calendar.empty')}</p>
            ) : (
              <ol className="flex flex-col">
                {agendaItems.map((item) => (
                  <li key={item.id} className="flex min-h-touch items-start gap-md border-b border-track py-md last:border-0">
                    <time
                      dateTime={formatLocalDateTime(selectedDate, item.time)}
                      className="w-12 shrink-0 pt-0.5 text-small font-bold text-ink"
                    >
                      {item.time}
                    </time>
                    <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <h3 className="text-small font-semibold text-ink">{t(item.titleKey)}</h3>
                      {item.subtitleKey !== undefined && (
                        <p className="mt-xs text-meta text-ink-secondary">{t(item.subtitleKey)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        <p className="text-meta text-ink-secondary">{t('calendar.description')}</p>
      </div>

      <BottomNav active="agenda" onVita={startCheckin} />
    </main>
  );
}
