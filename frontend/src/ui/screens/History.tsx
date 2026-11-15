import { useEffect, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import type { CheckRecord, Level, Observation, Verdict } from '@base-vital/contracts';
import { CHECKIN_PATH, HOME_PATH } from '../../config/constants';
import { getLocale } from '../../config/i18n';
import { t } from '../../config/messages.es';
import { useAppServices } from '../AppServices';
import { Badge } from '../components/Badge';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { PhysiologicalMetricsDashboard } from '../components/PhysiologicalMetricsDashboard';



/** Local date and time of a check, e.g. "15 nov 2026, 9:31". */
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** Badge level of each verdict (ok → green, attention → amber, alert → red). */
const VERDICT_LEVEL: Record<Verdict, Level> = {
  ok: 'green',
  attention: 'amber',
  alert: 'red',
};

/** Records sorted newest first (by the check's date-time, which is the record id). */
function newestFirst(records: readonly CheckRecord[]): CheckRecord[] {
  return [...records].sort((a, b) => Date.parse(b.id) - Date.parse(a.id));
}

/** Display value of one observation. Mood is a team criterion, so it is followed by its mark ("4*"). */
function valueText(observation: Observation): string {
  switch (observation.indicator) {
    case 'blood_pressure':
      return t('value.blood_pressure', {
        systolic: observation.value.systolic,
        diastolic: observation.value.diastolic,
      });
    case 'mood':
      return `${t('value.mood', { value: observation.value })}${t('team.criterion.mark')}`;
    default:
      return t(`value.${observation.indicator}`, { value: observation.value });
  }
}

/** Source label of one observation: "voz" for voice values, "equipo" for device values. */
function sourceLabel(source: Observation['source']): string {
  return source === 'voice' ? t('history.source.voice') : t('history.source.device');
}

interface HistoryRowProps {
  record: CheckRecord;
}

/** One saved check: date, simulated tag, verdict label and every observation with its source. */
function HistoryRow({ record }: HistoryRowProps) {
  return (
    <li data-testid="history-record">
      <Card className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div className="flex flex-wrap items-center gap-sm">
            <time dateTime={record.id} className="text-small font-semibold text-ink">
              {formatDateTime(new Date(record.id))}
            </time>
            {record.simulated && <span className="text-meta text-ink-secondary">{t('history.simulated')}</span>}
          </div>
          <Badge level={VERDICT_LEVEL[record.verdict]}>{t(`status.verdict.${record.verdict}`)}</Badge>
        </div>
        <ul className="grid grid-cols-1 gap-sm min-[400px]:grid-cols-2">
          {record.observations.map((observation) => (
            <li key={observation.indicator} className="flex min-w-0 flex-col gap-xs rounded-card bg-canvas p-md">
              <span className="text-meta text-ink-secondary">{t(`indicator.${observation.indicator}`)}</span>
              <span className="text-body font-semibold text-ink">{valueText(observation)}</span>
              <span className="text-meta text-ink-secondary">{sourceLabel(observation.source)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </li>
  );
}

/** History screen (T094, US6, CA8, HU6). Lists every saved check, newest first, from the repository. */
export function History() {
  const container = useAppServices();
  const history = useHistory();
  const [records, setRecords] = useState<CheckRecord[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const startCheckin = () => {
    history.push({ pathname: CHECKIN_PATH, state: { autostart: true } });
  };


  useEffect(() => {
    let active = true;
    container.repository.list().then(
      (list) => {
        if (active) setRecords(list);
      },
      () => {
        if (active) setLoadFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [container]);

  const rows = records === null ? [] : newestFirst(records);
  // The team-criterion note explains the "*" mark, so it is shown only when a mood value is listed.
  const hasMood = rows.some((record) => record.observations.some((o) => o.indicator === 'mood'));

  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto flex max-w-content flex-col gap-xl px-lg pb-dockClearance pt-xl md:px-page">
        <header className="flex items-center justify-between gap-md">
          <h1 className="text-title font-semibold text-ink">{t('screen.history')}</h1>
          <Link to={HOME_PATH} className="text-small font-semibold text-primary">
            {t('history.backHome')}
          </Link>
        </header>

        {/* Panel de Métricas Fisiológicas y Gráficos Clínicos */}
        <PhysiologicalMetricsDashboard />

        <div className="border-t border-slate-200 pt-md">
          <h2 className="mb-md text-label font-bold text-ink">{t('history.records.title')}</h2>
        </div>
        {loadFailed && <p className="text-body text-ink-secondary">{t('history.load_failed')}</p>}
        {records !== null && rows.length === 0 && <p className="text-body text-ink-secondary">{t('history.empty')}</p>}
        {rows.length > 0 && (
          <>
            <ul className="flex flex-col gap-md">
              {rows.map((record) => (
                <HistoryRow key={record.id} record={record} />
              ))}
            </ul>
            {hasMood && <p className="text-meta text-ink-secondary">{t('team.criterion.note')}</p>}
          </>
        )}
      </div>
      <BottomNav active="health" onVita={startCheckin} />
    </main>
  );

}
