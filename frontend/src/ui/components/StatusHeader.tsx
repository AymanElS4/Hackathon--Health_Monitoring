import type { ReactNode } from 'react';
import type { Level, Verdict } from '@base-vital/contracts';
import { t } from '../../config/messages.es';
import type { StatusMood } from '../../application/use-cases/buildHomeView';
import { Badge } from './Badge';

export interface StatusHeaderProps {
  crewName: string;
  /** `'none'` when there is no check today; shows "Sin chequeo hoy". */
  verdict: Verdict | 'none';
  mood: StatusMood | null;
  /** Optional element at the right end of the title row (e.g. "Ver historial"). It never wraps. */
  trailing?: ReactNode;
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
export function StatusHeader({ crewName, verdict, mood, trailing }: StatusHeaderProps) {
  const hasCheck = verdict !== 'none';

  return (
    <section className="flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-md">
        <h2 className="whitespace-nowrap text-body font-bold uppercase text-ink">
          {t('status.title', { name: crewName })}
        </h2>
        {trailing !== undefined && <div className="whitespace-nowrap">{trailing}</div>}
      </div>
      {hasCheck ? (
        <div className="flex flex-wrap items-center gap-sm">
          <Badge level={VERDICT_LEVEL[verdict]}>{t('status.today', { verdict: t(`status.verdict.${verdict}`) })}</Badge>
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
