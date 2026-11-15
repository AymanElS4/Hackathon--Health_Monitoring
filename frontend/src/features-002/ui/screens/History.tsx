import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CheckRecord } from '@base-vital/contracts';
import type { CheckRepositoryPort } from '../../application/ports';
import { t } from '../../config/messages.es';

interface HistoryProps {
  repository: CheckRepositoryPort;
}

export function History({ repository }: HistoryProps) {
  const [records, setRecords] = useState<CheckRecord[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    repository
      .list()
      .then((items) => {
        if (active) setRecords(items);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [repository]);

  return (
    <main className="simple-screen">
      <section className="simple-card">
        <Link className="brand" to="/" aria-label={t('screen.home')}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <path d="M20 5v30M5 20h30M9.4 9.4l21.2 21.2m0-21.2L9.4 30.6" />
              <circle cx="20" cy="20" r="7" />
            </svg>
          </span>
          <span className="brand-wordmark">{t('home.brandBase')}<span>{t('home.brandVital')}</span></span>
        </Link>
        <p className="eyebrow">{t('screen.history')}</p>
        <h1>{t('screen.history')}</h1>
        {error && <p className="history-error" role="alert">{t('history.loadError')}</p>}
        {!error && records.length === 0 && (
          <div className="empty-history">
            <span className="empty-history-icon" aria-hidden="true">
              <Icon />
            </span>
            <h2>{t('history.empty.title')}</h2>
            <p>{t('history.empty.description')}</p>
          </div>
        )}
        {records.map((record) => (
          <article className="history-record" key={record.id}>
            <header>
              <strong>{formatDate(record.id)}</strong>
              <span className={`level-badge level-badge--${verdictLevel(record.verdict)}`}>
                {t(`verdict.${record.verdict}`)}
              </span>
            </header>
            {record.simulated && (
              <p className="history-simulation">{t('history.simulation')}</p>
            )}
            <ul>
              {record.observations.map((observation, index) => {
                const rawValue =
                  typeof observation.value === 'number'
                    ? String(observation.value)
                    : `${observation.value.systolic}/${observation.value.diastolic}`;
                const moodMark = observation.indicator === 'mood' ? t('team.criterion.mark') : '';

                return (
                  <li key={`${observation.indicator}-${index}`}>
                    <span>{t(`indicator.${observation.indicator}`)}{moodMark}</span>
                    <span>
                      {t('history.valueWithSource', {
                        value: rawValue,
                        source: t(`history.source.${observation.source}`),
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
        {records.some((record) =>
          record.observations.some((observation) => observation.indicator === 'mood'),
        ) && <p className="history-criterion-note">{t('team.criterion.note')}</p>}
        <p><Link className="primary-button" to="/">{t('history.back')}</Link></p>
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function verdictLevel(verdict: CheckRecord['verdict']): string {
  return verdict === 'ok' ? 'green' : verdict === 'attention' ? 'amber' : 'red';
}

function Icon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22Z" />
      <path d="M4 5.5V22m4-15h8m-8 4h8" />
    </svg>
  );
}
