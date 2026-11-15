import type { BaselineIndicator, Indicator, Level, SensorKey } from '@base-vital/contracts';
import { TOKENS } from './design-tokens';

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
  /** Badge background, only for `green` (slate text on a light chip). */
  bg?: string;
}

/** Is the value fine? One entry per `Level`. */
export const LEVEL_COLORS = {
  green: { ring: null, label: '#64748B', bg: '#EEF2F6' },
  amber: { ring: '#F2A93B', label: '#F2A93B' },
  red: { ring: '#E5484D', label: '#E5484D' },
  in_doubt: { ring: '#9AA5B1', label: '#9AA5B1', ringStyle: 'dashed' },
  // Grey dot for "sin dato": no ring, dot filled with `fill`.
  unknown: { ring: null, label: '#C9D2DC', fill: '#C9D2DC' },
} satisfies Record<Level, LevelColor>;

/**
 * Fallback screen positions for sensor dots when the .glb node cannot be
 * resolved. `x` and `y` are percentages (0–100) of the width and height of
 * `public/models/body-fallback.png`, taken from the projected positions the
 * Blender render printed (T074, `FALLBACK_DOTS=` line of
 * `frontend/scripts/blender/create_sensor_empties.py`). Regenerate them with
 * that script whenever `body.glb` or the camera changes.
 */
export const FALLBACK_DOTS: Readonly<Record<SensorKey, { readonly x: number; readonly y: number }>> = {
  sleep: { x: 50.0, y: 10.1 },
  pulse: { x: 53.9, y: 28.4 },
  pressure: { x: 29.5, y: 28.8 },
  temperature: { x: 50.1, y: 41.4 },
  oxygen: { x: 13.0, y: 42.3 },
};

/** Display scale of one metric range bar (docs/base-vital-home-data-mapping.md §1). */
export interface UiScale {
  readonly min: number;
  readonly max: number;
  /** Key into `src/config/messages.es.ts` for the unit shown next to the scale. */
  readonly unitKey: string;
}

/** Range bar scales per body sensor. Values outside a scale are clamped by the layout. */
export const UI_SCALES: Readonly<Record<SensorKey, UiScale>> = {
  pressure: { min: 90, max: 160, unitKey: 'unit.pressure' },
  pulse: { min: 40, max: 130, unitKey: 'unit.pulse' },
  oxygen: { min: 85, max: 100, unitKey: 'unit.oxygen' },
  temperature: { min: 35, max: 39, unitKey: 'unit.temperature' },
  sleep: { min: 0, max: 10, unitKey: 'unit.sleep' },
} satisfies Record<SensorKey, UiScale>;

/** How long one voice listen waits for an answer before resolving null (ms). */
export const LISTEN_TIMEOUT_MS = 8000;

/** How long the "Próximamente" tooltip of a disabled tab or link stays on screen after a tap or focus (ms). */
export const SOON_TOOLTIP_MS = 2000;

/** Big-button sleep options: first and last hour, and the step between two options (hours). */
export const SLEEP_HOURS_MIN = 0;
export const SLEEP_HOURS_STEP = 0.5;

/** Observation indicator that carries each body sensor's number (range bar marker). */
export const SENSOR_INDICATOR: Readonly<Record<SensorKey, Indicator>> = {
  sleep: 'sleep_hours',
  pulse: 'resting_heart_rate',
  pressure: 'blood_pressure',
  temperature: 'body_temperature',
  oxygen: 'oxygen_saturation',
} satisfies Record<SensorKey, Indicator>;

/** Baseline indicator ("tu normal") that brackets each body sensor. Blood pressure uses the systolic baseline. */
export const SENSOR_BASELINE: Readonly<Record<SensorKey, BaselineIndicator>> = {
  sleep: 'sleep_hours',
  pulse: 'resting_heart_rate',
  pressure: 'systolic',
  temperature: 'body_temperature',
  oxygen: 'oxygen_saturation',
} satisfies Record<SensorKey, BaselineIndicator>;

/** Order of the metric rows in "Estado de Ana" (mockup order, not `SensorKey` order). */
export const METRIC_ORDER: readonly SensorKey[] = ['pressure', 'pulse', 'oxygen', 'temperature', 'sleep'];

/** Upcoming agenda items shown under "Lo próximo" on Home (Miller's 7±2 bound, research R17). */
export const NEXT_MAX = 2;

/** How often Home recomputes its view (clock minute, pending counts) while open (ms). */
export const HOME_REFRESH_MS = 60_000;

/** Route of the history screen (US6). Home and the check-in end card link to it. */
export const HISTORY_PATH = '/historial';

/** Route of the agenda calendar. */
export const AGENDA_PATH = '/agenda';

/** Route of the home screen. Used by the history screen to go back. */
export const HOME_PATH = '/';

/** Route of the check-in screen (RF1). Home starts a check-in here. */
export const CHECKIN_PATH = '/checkin';

/** How long a check-in save may take before it counts as failed (ms). */
export const SAVE_TIMEOUT_MS = 5000;

/** How long the startup seeding of the simulated history may take before the app renders anyway (ms). */
export const SEED_TIMEOUT_MS = 5000;

/** 3D body model (`public/models/body.glb`). Node names are fixed by contracts/body-glb.md. */
export const BODY_MODEL_URL = '/models/body.glb';

/** Local Draco decoder directory (Principle VII: no CDN). Must end with a slash. */
export const BODY_DRACO_PATH = '/models/draco/';

/** Largest rotation either side of the front view, in radians (±60°). */
export const BODY_AZIMUTH_LIMIT_RAD = Math.PI / 3;

/** Camera polar angle in radians: horizontal, so the body can only turn, not tilt. */
export const BODY_POLAR_ANGLE_RAD = Math.PI / 2;

/** Vertical field of view of the body camera, in degrees. */
export const BODY_CAMERA_FOV_DEG = 30;

/** Space kept around the fitted body (1 = touching the frame edge). */
export const BODY_FIT_MARGIN = 1.35;

/**
 * Z-index range of the body labels (drei `Html`, `zIndexRange`). The labels stay below the bottom
 * dock, which is `z-40` (`BottomNav`).
 */
export const BODY_LABEL_Z_INDEX_RANGE: number[] = [30, 0];

/** Media query of the reduced-motion preference; the body orbit damping follows it. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Length of the leader line from a sensor on the body to its dot, in CSS px. */
export const BODY_LEADER_PX = 16;

/** Box of one body sensor dot in px (`TOKENS.size.sensorRing`). Its center is the dot center. */
export const SENSOR_RING_PX = TOKENS.size.sensorRing;

/**
 * Where a sensor's status pill goes, relative to its dot. `right` and `left` put the pill beside the
 * dot on the same line; `above-left` and `below-left` put it above or below and to the left, with a
 * short vertical leader, so the pills of neighbouring dots do not collide on the body.
 */
export type LabelPlacement = 'right' | 'left' | 'above-left' | 'below-left';

/** Pill placement per body sensor (T072b fix 2). Pressure sits above the arm, oxygen below the hand. */
export const LABEL_PLACEMENT: Readonly<Record<SensorKey, LabelPlacement>> = {
  sleep: 'right',
  pulse: 'right',
  temperature: 'right',
  pressure: 'above-left',
  oxygen: 'below-left',
};

/** Local body image shown when the 3D body cannot run (CL5, ui-build §3 #2). */
export const BODY_FALLBACK_URL = '/models/body-fallback.png';

/** Pixel size of `body-fallback.png`. The fallback overlay box keeps this aspect so `FALLBACK_DOTS` line up. */
export const BODY_FALLBACK_SIZE = { width: 600, height: 900 } as const;

/** How long the 3D body may take to load before the fallback image replaces it (ms). */
export const BODY_LOAD_TIMEOUT_MS = 3000;

/** Milliseconds in one second. */
export const MS_PER_SECOND = 1000;

/**
 * Performance targets of the dev metrics overlay (T095, plan.md "Performance Goals"). Times are ms;
 * `fps` is the frame rate of the 3D canvas. Not health thresholds, so they live here, not in libs.
 */
export const DEV_TARGETS = {
  /** Start tap to `saved`: one daily check-in (SC-001, CA1). */
  checkinMs: 60_000,
  /** Prompt end to microphone open (plan.md: voice start ≤ 300 ms after the prompt). */
  voiceStartMs: 300,
  /** End of speech (last partial) to the final transcript (plan.md: ≤ 800 ms). */
  finalTranscriptMs: 800,
  /** Lowest acceptable 3D frame rate (plan.md: ≥ 30 fps). */
  fps: 30,
} as const;

/** Window over which the 3D frame-rate meter averages its frames (ms). */
export const FPS_WINDOW_MS = 1000;
