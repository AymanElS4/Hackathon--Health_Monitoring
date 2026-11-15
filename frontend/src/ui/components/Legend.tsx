import { t } from '../../config/messages.es';

/**
 * Legend of "Estado de Ana" (docs/design/README.md): the four zone and band keys, then the team
 * criterion line that explains the "*" mark (`team.criterion.note`, drawn only here on Home).
 * Colors come from the tokens and `LEVEL_COLORS`, never from hex.
 */
export function Legend() {
  return (
    <div className="flex flex-col items-end gap-xs text-meta text-ink-secondary">
      <ul className="flex flex-wrap items-center justify-end gap-md">
        <li className="inline-flex items-center gap-xs">
          <span aria-hidden="true" className="h-levelMarker w-levelMarker rounded-full bg-range-allowed" />
          {t('legend.allowed')}
        </li>
        <li className="inline-flex items-center gap-xs">
          <span aria-hidden="true" className="h-levelMarker w-levelMarker rounded-full bg-level-amber-ring" />
          {t('legend.attention')}
        </li>
        <li className="inline-flex items-center gap-xs">
          <span aria-hidden="true" className="h-levelMarker w-levelMarker rounded-full bg-level-red-ring" />
          {t('legend.alert')}
        </li>
        <li className="inline-flex items-center gap-xs">
          <span aria-hidden="true" className="h-xs w-lg rounded-full bg-baseline" />
          {t('legend.baseline')}
        </li>
      </ul>
      <p>{t('team.criterion.note')}</p>
    </div>
  );
}
