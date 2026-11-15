import type { ReactNode } from 'react';
import { Gauge, Heart, Moon, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import type { SensorKey } from '@base-vital/contracts';
import { t } from '../../config/messages.es';

export interface MetricRowProps {
  sensor: SensorKey;
  /** Display value. It already carries its unit when the reading has one (`formatReadingValue`). */
  value?: string;
  /** Unit shown after the value, when it is not already part of `value`. */
  unit?: string;
  /** Status badge slot. Empty when there is no reading. */
  badge?: ReactNode;
}

/** Icon per body sensor. Full class names, so Tailwind keeps them. */
const SENSOR_ICONS: Record<SensorKey, LucideIcon> = {
  pressure: Gauge,
  pulse: Heart,
  oxygen: Wind,
  temperature: Thermometer,
  sleep: Moon,
};

/** Icon circle (28 px, tinted with the sensor color) and icon color per sensor, from `SENSOR_COLORS`. */
const SENSOR_CLASSES: Record<SensorKey, { circle: string; icon: string }> = {
  sleep: { circle: 'bg-sensor-sleep/15', icon: 'text-sensor-sleep' },
  pulse: { circle: 'bg-sensor-pulse/15', icon: 'text-sensor-pulse' },
  pressure: { circle: 'bg-sensor-pressure/15', icon: 'text-sensor-pressure' },
  temperature: { circle: 'bg-sensor-temperature/15', icon: 'text-sensor-temperature' },
  oxygen: { circle: 'bg-sensor-oxygen/15', icon: 'text-sensor-oxygen' },
};

/**
 * One sensor row of "Estado de Ana": sensor icon in a 28 px circle tinted with the sensor color,
 * the name, the value in neutral ink with its unit, and the badge slot. The value is "—" with no
 * badge when there is no reading. Phase 7 (T090) adds the range bar under this line.
 */
export function MetricRow({ sensor, value, unit, badge }: MetricRowProps) {
  const Icon = SENSOR_ICONS[sensor];
  const classes = SENSOR_CLASSES[sensor];
  const hasValue = value !== undefined;

  return (
    <li className="flex min-h-touch items-center gap-md rounded-row bg-card p-md">
      <span
        className={`flex h-metricIcon w-metricIcon shrink-0 items-center justify-center rounded-full ${classes.circle}`}
      >
        <Icon aria-hidden="true" className={`h-lg w-lg ${classes.icon}`} />
      </span>
      <span className="min-w-0 flex-1 text-small font-semibold text-ink">{t(`sensor.${sensor}`)}</span>
      <div className="flex shrink-0 items-center gap-sm">
        <p className="whitespace-nowrap text-body font-bold text-ink">
          {hasValue ? value : t('value.missing')}
          {hasValue && unit !== undefined && <span className="ml-xs text-meta font-normal text-ink-secondary">{unit}</span>}
        </p>
        {badge}
      </div>
    </li>
  );
}
