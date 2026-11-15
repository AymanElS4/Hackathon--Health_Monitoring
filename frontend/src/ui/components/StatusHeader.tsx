import type { ReactNode } from 'react';
import type { Level, Verdict } from '@base-vital/contracts';
import { t } from '../../config/messages.es';
import type { StatusMood, StatusWhen } from '../../application/use-cases/buildHomeView';
import { getLocale } from '../../config/i18n';
import { useLocale } from '../useLocale';
import { Badge } from './Badge';

export interface StatusHeaderProps {
  crewName: string;
  /** `'none'` when there is no check today; shows "Sin chequeo hoy". */
  verdict: Verdict | 'none';
  mood: StatusMood | null;
  /** Optional element at the right end of the title row (e.g. "Ver historial"). It never wraps. */
  trailing?: ReactNode;
  /** `'previous'` when the card shows the latest earlier check (D56); default `'today'`. */
  source?: 'today' | 'previous';
  /** When the earlier check was made; used only with `source="previous"`. */
  when?: StatusWhen | null;
  /** The shown check is simulated; adds "simulado" to the earlier-check label. */
  simulated?: boolean;
}

/** Short local date of a `YYYY-MM-DD` day in the UI language, e.g. "12 nov". */
function shortDate(day: string, locale: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, date));
}

/** Badge level of each verdict (ok → green, attention → amber, alert → red). */
const VERDICT_LEVEL: Record<Verdict, Level> = {
  ok: 'green',
  attention: 'amber',
  alert: 'red',
};

/**
 * Title of "Estado de Ana" with its trailing link on row 1, and the verdict and mood chips (or
 * "Sin chequeo hoy") on row 2. The rows are fixed, so the link never shares a line with the chips.
 * The verdict word appears once (SC-010).
 */
export function StatusHeader({ crewName, verdict, mood, trailing, source = 'today', when = null, simulated = false }: StatusHeaderProps) {
  useLocale();
  const hasCheck = verdict !== 'none';
  const previous = hasCheck && source === 'previous' && when !== null;
  const whenText = when === null ? '' : when.kind === 'yesterday' ? t('status.yesterday') : shortDate(when.date, getLocale());
  const verdictText = hasCheck ? t(`status.verdict.${verdict}`) : '';
  const chipText = previous
    ? when?.kind === 'yesterday'
      ? t('status.previous', { verdict: verdictText })
      : t('status.previousDated', { when: whenText, verdict: verdictText })
    : t('status.today', { verdict: verdictText });

  return (
    <section className="flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-md">
        <h2 className="whitespace-nowrap text-body font-bold uppercase text-ink">
          {t('status.title', { name: crewName })}
        </h2>
        {trailing !== undefined && <div className="whitespace-nowrap">{trailing}</div>}
      </div>
      {previous && (
        <p className="text-meta text-ink-secondary">
          {t(simulated ? 'status.lastCheckSimulated' : 'status.lastCheck', { when: whenText })}
        </p>
      )}
      {hasCheck ? (
        <div className="flex flex-wrap items-center gap-sm">
          <Badge level={VERDICT_LEVEL[verdict]}>{chipText}</Badge>
          {mood !== null && (
            <Badge level={mood.level} mark={mood.teamCriterion}>
              {t('status.mood', { value: mood.value, of: mood.of })}
            </Badge>
          )}
        </div>
      ) : (
        <p className="text-meta text-ink-secondary">{t('status.noCheck')}</p>
      )}
    </section>
  );
}
