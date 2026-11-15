import type { SensorKey } from '@base-vital/contracts';
import { METRIC_ORDER } from '../../config/constants';
import type { StatusReading } from '../../application/use-cases/metricReadings';
import { MetricRow } from './MetricRow';
import { computeRangeBar, type RangeBarLayout } from './rangeBarLayout';

export interface MetricRowsProps {
  /** Metric rows of one check (`metricReadingsOf`); a sensor missing here shows "—" with no bar. */
  readings: readonly StatusReading[];
  /** Sensor whose row is highlighted: the one focused on the body (FR-017, SC-012). */
  focus: SensorKey | null;
  /** Called with the sensor of a tapped row. Omitted: rows are not tappable (check-in). */
  onSelect?: (sensor: SensorKey) => void;
}

/** Range bar of one row, from its marker, scale and baseline. None without a marker (no number to place). */
function layoutOf(reading: StatusReading | undefined): RangeBarLayout | undefined {
  if (reading === undefined || reading.marker === null) return undefined;
  return computeRangeBar({
    sensor: reading.sensor,
    value: reading.marker,
    baseline: reading.baseline,
    scale: reading.scale,
  });
}

/**
 * The five metric rows of "Estado de Ana", in `METRIC_ORDER`, with their range bars. Shared by the
 * Home status card and the check-in summary, so both show the same rows.
 */
export function MetricRows({ readings, focus, onSelect }: MetricRowsProps) {
  const bySensor = new Map(readings.map((reading) => [reading.sensor, reading]));
  return (
    <ul className="flex flex-col gap-xs">
      {METRIC_ORDER.map((sensor) => {
        const reading = bySensor.get(sensor);
        return (
          <MetricRow
            key={sensor}
            sensor={sensor}
            value={reading?.value}
            level={reading?.level}
            reason={reading?.reason}
            teamCriterion={reading?.teamCriterion}
            source={reading?.source ?? undefined}
            simulated={reading?.simulated}
            allowedLabel={reading?.allowedLabel}
            highlighted={focus === sensor}
            layout={layoutOf(reading)}
            baselineLearning={reading !== undefined && !reading.baseline.ready}
            onSelect={onSelect === undefined ? undefined : () => onSelect(sensor)}
          />
        );
      })}
    </ul>
  );
}
