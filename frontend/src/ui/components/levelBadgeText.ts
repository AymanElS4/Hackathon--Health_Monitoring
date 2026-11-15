import type { Level } from '@base-vital/contracts';
import { t } from '../../config/messages.es';

/** Badge text of a level on the metric rows and the status card: the verdict words for green, amber and red. */
export function levelBadgeText(level: Level): string {
  switch (level) {
    case 'green':
      return t('status.verdict.ok');
    case 'amber':
      return t('status.verdict.attention');
    case 'red':
      return t('status.verdict.alert');
    default:
      return t(`level.${level}`);
  }
}
