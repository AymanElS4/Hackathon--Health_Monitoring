import type { BaselineIndicator, Level, SensorKey } from '../contracts';

/**
 * Two separate color tables. `SENSOR_COLORS` says WHICH sensor a reading
 * belongs to; `LEVEL_COLORS` says whether a value is fine. They must never
 * share a hex value (see tests/unit/colors.test.ts).
 */

/** Identity color per body sensor. */
export const SENSOR_COLORS: Record<SensorKey, string> = {
  sleep: '#5B5FD6',
  pulse: '#D946A8',
  pressure: '#9D5CE6',
  temperature: '#14A3A0',
  oxygen: '#38A3E8',
} satisfies Record<SensorKey, string>;

/** Level color table. Uniform shape for every level. */
export interface LevelColor {
  /** Ring color around the 3D sensor; `null` means no ring. */
  ring: string | null;
  /** Color of the text label for the level. */
  label: string;
  /** Ring line style; omitted means solid. */
  ringStyle?: 'solid' | 'dashed';
  /**
   * Grey dot fill, only for `unknown` (no data). Other levels do not use it.
   * The dot color is an explicit fill, not a ring.
   */
  fill?: string;
}

/** Is the value fine? One entry per `Level`. */
export const LEVEL_COLORS = {
  green: { ring: null, label: '#64748B' },
  amber: { ring: '#F2A93B', label: '#F2A93B' },
  red: { ring: '#E5484D', label: '#E5484D' },
  in_doubt: { ring: '#9AA5B1', label: '#9AA5B1', ringStyle: 'dashed' },
  // Grey dot for "sin dato": no ring, dot filled with `fill`.
  unknown: { ring: null, label: '#C9D2DC', fill: '#C9D2DC' },
} satisfies Record<Level, LevelColor>;

/**
 * Minimum standard deviation per baseline indicator ("tu normal", RN3).
 * Keeps a perfectly flat history from producing SD 0. Team criteria, not clinical.
 * Units: sleep h, mood points, resting HR bpm, BP mmHg, temperature °C, SpO₂ %.
 */
export const MIN_SD: Record<BaselineIndicator, number> = {
  sleep_hours: 0.5,
  mood: 0.5,
  resting_heart_rate: 3,
  systolic: 4,
  diastolic: 3,
  body_temperature: 0.2,
  oxygen_saturation: 1,
} satisfies Record<BaselineIndicator, number>;

/**
 * Fallback screen positions for sensor dots when the .glb node cannot be
 * resolved. Empty placeholder; T057 fills it.
 */
export const FALLBACK_DOTS: Partial<Record<SensorKey, { x: number; y: number }>> = {};
