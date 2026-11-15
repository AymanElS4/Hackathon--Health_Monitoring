import type { CSSProperties } from 'react';
import type { Indicator, Level, SensorKey } from '@base-vital/contracts';
import { BODY_LEADER_PX, LEVEL_COLORS, SENSOR_COLORS, type LevelColor } from '../../config/constants';
import { t } from '../../config/messages.es';

/** Side of the dot where the status pill goes. Right by default. */
export type LabelSide = 'left' | 'right';

export interface SensorDotProps {
  sensor: SensorKey;
  /** Level of the sensor, or `null` before the check is evaluated (a plain identity dot: no ring, no pill). */
  level: Level | null;
  /** Indicator that set the level; `null` when green or when no indicator applies. */
  reason: Indicator | null;
  /** Adds the team criterion mark (`team.criterion.mark`) to the status label. */
  teamCriterion: boolean;
  /** Shows the focus halo (the sensor being discussed). */
  focused: boolean;
  /** Shows the measuring spinner. */
  measuring: boolean;
  /**
   * Called with the sensor key when the dot is tapped. Without it the dot is a non-interactive
   * image with the same visuals.
   */
  onSensorTap?: (sensor: SensorKey) => void;
  /** Where the status pill goes relative to the dot; the dot stays on the body side. Default `right`. */
  labelSide?: LabelSide;
}

/**
 * Text color of the status pill. The text is always `ink` (secondary ink fails AA at 13 px); the
 * level color is carried by the marker inside the pill and by the ring. Green has no pill.
 */
const PILL_TEXT_CLASSES: Record<Exclude<Level, 'green'>, string> = {
  amber: 'text-ink',
  red: 'text-ink',
  in_doubt: 'text-ink',
  unknown: 'text-ink',
};

/** Color of the level marker inside the pill: the ring color, or the label color when there is no ring. */
function markerColor(colors: LevelColor): string {
  return colors.ring ?? colors.label;
}

/**
 * Two-line status pill of an altered level. The top line is the reason that set the level (the
 * sensor name in practice), the bottom line is the level with its mark. The full text
 * "{reason} · {level}" (e.g. "Sueño · atención") is the accessible name of the dot.
 */
interface StatusPill {
  /** Text color key of the pill (never green: green has no pill). */
  tone: Exclude<Level, 'green'>;
  name: string;
  level: string;
  text: string;
}

function statusPill(
  sensor: SensorKey,
  level: Exclude<Level, 'green'>,
  reason: Indicator | null,
  teamCriterion: boolean,
): StatusPill {
  const levelText = t(`level.${level}`);
  const name = reason ? t(`indicator.${reason}`) : t(`sensor.${sensor}`);
  const base = reason ? t('dot.label', { reason: name, level: levelText }) : levelText;
  const mark = teamCriterion ? t('team.criterion.mark') : '';
  return { tone: level, name, level: `${levelText}${mark}`, text: `${base}${mark}` };
}

/**
 * One body sensor on the 3D body (or on the fallback image). Before evaluation (`level` null) it is a
 * 10 px dot in the sensor color with a white outline. Altered levels (amber, red, in_doubt) grow to
 * 14 px, get a pulsing ring in the level color and a status pill with a level marker. A leader line
 * runs from the dot's box to the pill, on the label side. The dot's center is the box center, so the
 * caller anchors the box center on the body point (see `SensorCallout`). With `onSensorTap` the dot
 * is a button; its tap area is a 48 px box centered on the dot, and the rest (leader, pill) takes no
 * taps, so a pill can never catch a tap meant for another control. Without `onSensorTap` it is a
 * non-interactive image. Colors come from `SENSOR_COLORS` and `LEVEL_COLORS`; motion is off under
 * `prefers-reduced-motion`.
 */
export function SensorDot({
  sensor,
  level,
  reason,
  teamCriterion,
  focused,
  measuring,
  onSensorTap,
  labelSide = 'right',
}: SensorDotProps) {
  const colors: LevelColor | null = level === null ? null : LEVEL_COLORS[level];
  const fill = level === 'unknown' ? LEVEL_COLORS.unknown.fill : SENSOR_COLORS[sensor];
  const altered = colors !== null && colors.ring !== null;
  const pill: StatusPill | null =
    level !== null && level !== 'green' ? statusPill(sensor, level, reason, teamCriterion) : null;
  const sensorLabel = t(`sensor.${sensor}`);
  const accessibleName = pill ? `${sensorLabel}, ${pill.text}` : sensorLabel;

  const ringStyle: CSSProperties | undefined =
    colors !== null && colors.ring !== null
      ? { borderColor: colors.ring, borderStyle: colors.ringStyle ?? 'solid' }
      : undefined;

  const dotSize = altered ? 'h-sensorDotAltered w-sensorDotAltered' : 'h-sensorDot w-sensorDot';
  const interactive = onSensorTap !== undefined;
  // The root takes no pointer events: only the tap target inside the ring box does (see below).
  const rootClass = [
    'relative inline-flex items-center justify-start rounded-full bg-transparent p-0 pointer-events-none',
    interactive ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : '',
    labelSide === 'left' ? 'flex-row-reverse' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="relative flex h-sensorRing w-sensorRing shrink-0 items-center justify-center">
        {focused && (
          <span
            aria-hidden="true"
            className="sensor-dot__halo absolute inset-0 rounded-full opacity-sensor-halo"
            style={{ backgroundColor: SENSOR_COLORS[sensor] }}
          />
        )}
        {measuring && (
          <span
            aria-hidden="true"
            className="sensor-dot__spinner absolute inset-0 rounded-full border-sensor border-transparent border-t-primary motion-safe:animate-sensor-spin"
          />
        )}
        {altered && (
          <span
            aria-hidden="true"
            data-testid="sensor-dot-ring"
            className="absolute inset-0 rounded-full border-sensor motion-safe:animate-sensor-pulse"
            style={ringStyle}
          />
        )}
        <span
          aria-hidden="true"
          data-testid="sensor-dot-fill"
          className={`relative block rounded-full border-sensor border-card ${dotSize}`}
          style={{ backgroundColor: fill }}
        />
        {interactive && (
          <span
            aria-hidden="true"
            data-testid="sensor-dot-hit"
            className="pointer-events-auto absolute left-1/2 top-1/2 min-h-touch min-w-touch -translate-x-1/2 -translate-y-1/2 cursor-pointer"
          />
        )}
      </span>
      {pill && (
        <span
          aria-hidden="true"
          data-testid="sensor-dot-leader"
          className="block h-px shrink-0 bg-line"
          style={{ width: BODY_LEADER_PX }}
        />
      )}
      {pill && colors && (
        <span
          className={`inline-flex shrink-0 flex-col items-start rounded-card border border-line bg-card px-sm py-xs text-meta font-semibold leading-tight shadow-ambient ${PILL_TEXT_CLASSES[pill.tone]}`}
        >
          <span className="whitespace-nowrap" data-testid="sensor-dot-pill-name">
            {pill.name}
          </span>
          <span className="inline-flex items-center gap-xs whitespace-nowrap" data-testid="sensor-dot-pill-level">
            <span
              aria-hidden="true"
              data-testid="sensor-dot-level-marker"
              className="h-levelMarker w-levelMarker shrink-0 rounded-full"
              style={{ backgroundColor: markerColor(colors) }}
            />
            {pill.level}
          </span>
        </span>
      )}
    </>
  );

  if (onSensorTap) {
    return (
      <button
        type="button"
        data-sensor={sensor}
        data-level={level ?? undefined}
        aria-label={accessibleName}
        onClick={() => onSensorTap(sensor)}
        className={rootClass}
      >
        {content}
      </button>
    );
  }

  return (
    <span role="img" data-sensor={sensor} data-level={level ?? undefined} aria-label={accessibleName} className={rootClass}>
      {content}
    </span>
  );
}
