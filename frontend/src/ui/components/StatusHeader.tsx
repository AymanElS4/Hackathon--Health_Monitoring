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
  /** Optional element at the right end of the title row (e.g. "Ver historial →"). */
  trailing?: ReactNode;
}

/** Badge level of each verdict (ok → green, attention → amber, alert → red). */
const VERDICT_LEVEL: Record<Verdict, Level> = {
  ok: 'green',
  attention: 'amber',
  alert: 'red',
};

/** Title, today's verdict chip and mood chip for Home (FR-016, SC-010). The verdict word appears once. */
export function StatusHeader({ crewName, verdict, mood, trailing }: StatusHeaderProps) {
  const hasCheck = verdict !== 'none';

  return (
    <section className="flex flex-col gap-sm">
      <div className="flex flex-wrap items-center gap-sm">
        <h2 className="text-body font-bold uppercase text-ink">{t('status.title', { name: crewName })}</h2>
        {hasCheck && (
          <>
            <Badge level={VERDICT_LEVEL[verdict]}>
              {t('status.today', { verdict: t(`status.verdict.${verdict}`) })}
            </Badge>
            {mood !== null && (
              <Badge level={mood.level} mark={mood.teamCriterion}>
                {t('status.mood', { value: mood.value, of: mood.of })}
              </Badge>
            )}
          </>
        )}
        {trailing !== undefined && <div className="ml-auto">{trailing}</div>}
      </div>
      {!hasCheck && <p className="text-meta text-ink-secondary">{t('status.noCheck')}</p>}
    </section>
  );
}
