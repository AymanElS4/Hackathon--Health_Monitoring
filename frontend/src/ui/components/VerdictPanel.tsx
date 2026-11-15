import type { Level, Verdict } from '@base-vital/contracts';
import { t } from '../../config/messages.es';
import { Badge } from './Badge';
import { Card } from './Card';

export interface VerdictPanelProps {
  verdict: Verdict;
  /** Message key of the one action; `''` when there is none (verdict ok). */
  actionKey: string;
  /** Values for the placeholders of the action text, e.g. `{ sensor: 'la presión' }`. */
  actionParams?: Record<string, string>;
  /** Next activity of the day; `null` when the day has no more. */
  next: { title: string; time: string } | null;
}

/** Badge level of each verdict (RN6: the label says whether it is fine). */
const VERDICT_LEVEL: Record<Verdict, Level> = {
  ok: 'green',
  attention: 'amber',
  alert: 'red',
};

/**
 * Verdict label, one action and the next activity (RF9, RF10). The team-criterion note is not drawn
 * here: the screen renders it once for all marks (`needsTeamNote`, Principle VIII).
 */
export function VerdictPanel({ verdict, actionKey, actionParams = {}, next }: VerdictPanelProps) {
  return (
    <Card>
      <div className="flex flex-col gap-md">
        <div>
          <Badge level={VERDICT_LEVEL[verdict]}>{t(`status.verdict.${verdict}`)}</Badge>
        </div>
        {actionKey !== '' && (
          <p className="text-body font-semibold text-ink">{t(actionKey, actionParams)}</p>
        )}
        <p className="text-small text-ink-secondary">
          {next === null
            ? t('next.none')
            : t('next', { title: next.title, time: next.time })}
        </p>
      </div>
    </Card>
  );
}
