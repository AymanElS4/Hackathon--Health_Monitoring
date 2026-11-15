import { useId, useState } from 'react';
import { Gauge, Heart, Moon, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import type { Indicator, Level, SensorKey } from '@base-vital/contracts';
import { METRIC_ORDER, SENSOR_INDICATOR } from '../../../config/constants';
import { t } from '../../../config/messages.es';
import type { StatusReading } from '../../../application/use-cases/metricReadings';
import { Badge } from '../Badge';
import { MetricRows } from '../MetricRows';
import { levelBadgeText } from '../levelBadgeText';

export interface ChatSummaryProps {
  /** Metric rows of the check (`metricReadingsOf`). */
  readings: readonly StatusReading[];
  /** Sensor highlighted in the full rows. */
  focus: SensorKey | null;
}

const ICONS: Record<SensorKey, LucideIcon> = {
  pressure: Gauge,
  pulse: Heart,
  oxygen: Wind,
  temperature: Thermometer,
  sleep: Moon,
};

/** Tinted circle and icon colors per sensor (full class names, so Tailwind keeps them). */
const CLASSES: Record<SensorKey, { circle: string; icon: string }> = {
  sleep: { circle: 'bg-sensor-sleep/15', icon: 'text-sensor-sleep' },
  pulse: { circle: 'bg-sensor-pulse/15', icon: 'text-sensor-pulse' },
  pressure: { circle: 'bg-sensor-pressure/15', icon: 'text-sensor-pressure' },
  temperature: { circle: 'bg-sensor-temperature/15', icon: 'text-sensor-temperature' },
  oxygen: { circle: 'bg-sensor-oxygen/15', icon: 'text-sensor-oxygen' },
};

/** Badge text: the level word, or "{reason}: {level}" when another indicator than the row's own set it (D47). */
function badgeText(sensor: SensorKey, level: Level, reason: Indicator | null): string {
  if (reason === null || reason === SENSOR_INDICATOR[sensor]) return levelBadgeText(level);
  return t('metric.reasonBadge', { reason: t(`indicator.${reason}`), level: t(`level.${level}`) });
}

/**
 * Compact summary inside the verdict message: one line per sensor (icon, name, value, badge), no range
 * bars. "Ver detalle" reveals the full metric rows; collapsed by default.
 */
export function ChatSummary({ readings, focus }: ChatSummaryProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const bySensor = new Map(readings.map((reading) => [reading.sensor, reading]));
  return (
    <div className="flex flex-col gap-sm">
      <ul data-testid="chat-summary" className="flex flex-col gap-xs">
        {METRIC_ORDER.map((sensor) => {
          const reading = bySensor.get(sensor);
          const Icon = ICONS[sensor];
          return (
            <li key={sensor} data-sensor={sensor} className="flex flex-wrap items-center gap-x-xs gap-y-xs py-xs">
              <span
                className={`flex h-metricIcon w-metricIcon shrink-0 items-center justify-center rounded-full ${CLASSES[sensor].circle}`}
              >
                <Icon aria-hidden="true" className={`h-lg w-lg ${CLASSES[sensor].icon}`} />
              </span>
              <span className="shrink-0 text-small font-semibold text-ink">{t(`sensor.${sensor}`)}</span>
              <span className="min-w-0 flex-1 whitespace-nowrap text-right text-meta font-bold text-ink">
                {reading === undefined ? t('value.missing') : reading.value}
              </span>
              {reading !== undefined && (
                <Badge level={reading.level} mark={reading.teamCriterion}>
                  {badgeText(sensor, reading.level, reading.reason)}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((value) => !value)}
        className="min-h-touch w-fit rounded-card px-md text-small font-semibold text-primary"
      >
        {open ? t('checkin.details.hide') : t('checkin.details.show')}
      </button>
      <div id={detailId}>{open && <MetricRows readings={readings} focus={focus} />}</div>
    </div>
  );
}
