/**
 * Pure logic behind `BodyViewer` (T078). No WebGL and no three.js here, so this module is safe to
 * import from the eagerly loaded fallback. It decides which dot each sensor gets, which side its
 * label sits on and how far the camera must be to frame the body. The node positions live in
 * `sensorPositions.ts`, which is the only body module that imports three.
 */
import { SensorKey, type Level, type SensorReading } from '@base-vital/contracts';
import type { LabelSide } from './SensorDot';

/** The reading fields the body needs. Both `SensorReading` and `StatusReading` have them. */
export type BodyReading = Pick<SensorReading, 'sensor' | 'level' | 'reason' | 'teamCriterion'>;

/** Props of one `SensorDot` on the body, plus the leader side. */
export interface BodyDotModel {
  sensor: SensorKey;
  /** `null` before the check is evaluated: the dot is then a plain sensor-colored identity dot. */
  level: Level | null;
  reason: BodyReading['reason'];
  teamCriterion: boolean;
  focused: boolean;
  measuring: boolean;
  labelSide: LabelSide;
}

/**
 * Label side of each dot: the side of the screen away from the body centre (RF6). The body's left
 * arm and chest are on the screen right, its right arm on the screen left.
 */
const LABEL_SIDE: Record<SensorKey, LabelSide> = {
  sleep: 'right',
  pulse: 'right',
  pressure: 'left',
  temperature: 'right',
  oxygen: 'left',
};

/** Label side of a sensor's dot. */
export function labelSideOf(sensor: SensorKey): LabelSide {
  return LABEL_SIDE[sensor];
}

/** Name of the empty node that marks a sensor on the .glb (contracts/body-glb.md). */
export function sensorNodeName(sensor: SensorKey): string {
  return `sensor_${sensor}`;
}

/**
 * One dot model per sensor, in `SensorKey` order.
 * Before the check is evaluated (`evaluated` false) every dot has `level: null` and no status.
 * Once evaluated, a sensor without a reading is `unknown` ("sin dato", CL2).
 * `measuring` applies only to the focused sensor (the one being measured).
 */
export function bodyDotModels(
  readings: readonly BodyReading[],
  focus: SensorKey | null,
  measuring: boolean,
  evaluated: boolean,
): BodyDotModel[] {
  return SensorKey.options.map((sensor) => {
    const reading = evaluated ? readings.find((r) => r.sensor === sensor) : undefined;
    const focused = focus === sensor;
    return {
      sensor,
      level: evaluated ? (reading?.level ?? 'unknown') : null,
      reason: reading?.reason ?? null,
      teamCriterion: reading?.teamCriterion ?? false,
      focused,
      measuring: measuring && focused,
      labelSide: labelSideOf(sensor),
    };
  });
}

/** Degrees in a half turn; a field of view is given in degrees, the math needs radians. */
const HALF_TURN_DEG = 180;
/** Half of a size: the camera fits half the body on each side of its center. */
const HALF = 0.5;

/**
 * Camera distance from the body center that frames `size` (bounding box) in a viewport with the
 * given aspect (width / height) and vertical field of view. The tighter of the height and width
 * fits wins, so a narrow (portrait) viewport moves the camera back far enough.
 */
export function cameraDistanceToFit(
  size: { x: number; y: number; z: number },
  verticalFovDeg: number,
  aspect: number,
  margin: number,
): number {
  const halfTan = Math.tan((verticalFovDeg * Math.PI) / HALF_TURN_DEG * HALF);
  const byHeight = size.y * HALF / halfTan;
  const byWidth = size.x * HALF / (halfTan * aspect);
  return Math.max(byHeight, byWidth) * margin + size.z * HALF;
}
