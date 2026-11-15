import type { ReactNode } from 'react';
import { Gauge, Heart, Moon, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import type { Level, SensorKey, Source } from '@base-vital/contracts';
import { t } from '../../config/messages.es';
import { Badge } from './Badge';
import { RangeBar } from './RangeBar';
import { levelBadgeText } from './levelBadgeText';
import type { RangeBarLayout } from './rangeBarLayout';

export interface MetricRowProps {
  sensor: SensorKey;
  /** Display value. It already carries its unit when the reading has one (`formatReadingValue`). */
  value?: string;
  /** Unit shown after the value, when it is not already part of `value`. */
  unit?: string;
  /** Status badge slot. Takes precedence over `level`. Empty when there is no reading. */
  badge?: ReactNode;
  /** Level of the reading; when set (and no `badge` is given) the row shows its Badge. */
  level?: Level;
  /** Adds the team criterion mark ("*") to the Badge. */
  teamCriterion?: boolean;
  /** Where the value came from. */
  source?: Source;
  /** Device value that comes from the simulated device: shows "equipo simulado". */
  simulated?: boolean;
  /** Row of the sensor that is focused on the body. */
  highlighted?: boolean;
  /** Range bar under the line. Omitted: no bar. */
  layout?: RangeBarLayout;
  /** Baseline not ready: the range bar shows "Aún aprendo tu normal" instead of the band. */
  baselineLearning?: boolean;
  /** Allowed range as text, e.g. "60–100" (CA7). Shown centred under the bar. */
  allowedLabel?: string;
  /** Called when the row is tapped; the screen highlights the sensor on the body (FR-017). */
  onSelect?: () => void;
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
 * the name (with the "equipo simulado" note for simulated device values), the value in neutral ink
 * with its unit, and the badge. The value is "—" with no badge when there is no reading. With a
 * `layout`, the range bar sits under the line (docs/design/README.md "Metric row"). The row wraps,
 * so the bar takes the full width below the line.
 */
export function MetricRow({
  sensor,
  value,
  unit,
  badge,
  level,
  teamCriterion = false,
  source,
  simulated = false,
  highlighted = false,
  layout,
  baselineLearning = false,
  allowedLabel,
  onSelect,
}: MetricRowProps) {
  const Icon = SENSOR_ICONS[sensor];
  const classes = SENSOR_CLASSES[sensor];
  const hasValue = value !== undefined;
  const showDeviceNote = source === 'device' && simulated;
  const valueLabel = hasValue ? (unit !== undefined ? `${value} ${unit}` : value) : '';
  const slot =
    badge ?? (level === undefined ? null : <Badge level={level} mark={teamCriterion}>{levelBadgeText(level)}</Badge>);

  return (
    <li
      data-highlighted={highlighted ? 'true' : 'false'}
      onClick={onSelect}
      className={`flex flex-wrap items-center gap-x-md gap-y-xs rounded-row bg-card px-md py-xs ${highlighted ? 'ring-2 ring-primary' : ''} ${onSelect ? 'cursor-pointer' : ''}`}
    >
      <span
        className={`flex h-metricIcon w-metricIcon shrink-0 items-center justify-center rounded-full ${classes.circle}`}
      >
        <Icon aria-hidden="true" className={`h-lg w-lg ${classes.icon}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-small font-semibold text-ink">
          {t(`sensor.${sensor}`)}
          {showDeviceNote && (
            <span className="ml-xs text-meta font-normal text-ink-secondary">
              {t('meta.separator')} <span>{t('device.simulated')}</span>
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-sm">
        <p className="whitespace-nowrap text-body font-bold text-ink">
          <span className="text-ink">{hasValue ? value : t('value.missing')}</span>
          {hasValue && unit !== undefined && <span className="ml-xs text-meta font-normal text-ink-secondary">{unit}</span>}
        </p>
        {slot}
      </div>
      {layout !== undefined && (
        <div className="basis-full">
          <RangeBar
            layout={layout}
            valueLabel={valueLabel}
            baselineLearning={baselineLearning}
            allowedLabel={allowedLabel === undefined || allowedLabel === '' ? undefined : t('allowed.shown', { range: allowedLabel })}
          />
        </div>
      )}
    </li>
  );
}
