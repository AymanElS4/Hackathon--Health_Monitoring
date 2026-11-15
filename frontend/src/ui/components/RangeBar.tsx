import type { Level } from '@base-vital/contracts';
import { t } from '../../config/messages.es';
import type { RangeBarLayout } from './rangeBarLayout';

export interface RangeBarProps {
  /** Zones, marker, "tu normal" band and cut points, from `computeRangeBar`. */
  layout: RangeBarLayout;
  /** Formatted value for the small bubble above the marker, e.g. "72 lpm". */
  valueLabel: string;
  /** True while the baseline is not ready: the band is replaced by "Aún aprendo tu normal". */
  baselineLearning?: boolean;
  /** Allowed range shown centred under the bar, e.g. "Permitido 60–100" (CA7). */
  allowedLabel?: string;
}

/** Zone fill per level. Allowed uses its own range token; the other levels use the level ring/fill tokens. */
const ZONE_CLASSES: Record<Level, string> = {
  green: 'bg-range-allowed',
  amber: 'bg-level-amber-ring',
  red: 'bg-level-red-ring',
  in_doubt: 'bg-level-in_doubt-ring',
  unknown: 'bg-level-unknown-fill',
};

/** Position of an element on the scale, as an inline `left` in percent of the bar. */
const leftStyle = (pct: number) => ({ left: `${pct}%` });

/**
 * Range bar of one metric row (docs/design/home-mockup-body-dots.png): zones with 2 px white gaps,
 * a small value bubble above a 10 px marker dot, the "tu normal" band in the gap under the bar, and
 * the allowed range centred under it. The bubble row and the label row have fixed heights, so a row
 * with a bar stays within its compact height. Positions come from `computeRangeBar`.
 */
export function RangeBar({ layout, valueLabel, baselineLearning = false, allowedLabel }: RangeBarProps) {
  const { markerPct, baselinePct } = layout;
  // While the baseline is learning, the band is hidden and the learning text takes its place.
  const band = baselineLearning ? null : baselinePct;

  return (
    <div data-testid="range-bar" className="flex w-full flex-col">
      <div className="relative h-rangeBubbleRow w-full">
        {markerPct !== null && (
          <div
            data-testid="range-bubble"
            className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap rounded-row bg-ink px-xs text-meta font-bold text-white"
            style={leftStyle(markerPct)}
          >
            {valueLabel}
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-full h-rangePointer w-rangePointer -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink"
            />
          </div>
        )}
      </div>

      <div className="relative mb-xs h-rangeBar w-full">
        <div data-testid="range-zones" className="flex h-full w-full gap-[2px] overflow-hidden rounded-full bg-card">
          {layout.zones.map((zone, index) => (
            <div
              key={index}
              data-testid="range-zone"
              data-level={zone.level}
              className={`h-full basis-0 ${ZONE_CLASSES[zone.level]}`}
              style={{ flexGrow: zone.toPct - zone.fromPct }}
            />
          ))}
        </div>
        {markerPct !== null && (
          <div
            data-testid="range-marker"
            className="absolute top-1/2 h-rangeMarker w-rangeMarker -translate-x-1/2 -translate-y-1/2 rounded-full border-rangeMarker border-white bg-ink"
            style={leftStyle(markerPct)}
          />
        )}
        {band !== null && (
          <div
            data-testid="range-baseline"
            className="absolute top-full h-rangeBaseline rounded-full bg-baseline"
            style={{ left: `${band.from}%`, width: `${band.to - band.from}%` }}
          />
        )}
      </div>

      <div className="relative h-rangeCutRow w-full text-meta">
        {allowedLabel !== undefined && allowedLabel !== '' && (
          <p
            data-testid="range-allowed"
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-primary"
          >
            {allowedLabel}
          </p>
        )}
        {baselineLearning && (
          <p className="absolute right-0 whitespace-nowrap text-ink-secondary">{t('baseline.learning')}</p>
        )}
      </div>
    </div>
  );
}
