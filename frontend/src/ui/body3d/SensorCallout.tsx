import type { SensorKey } from '@base-vital/contracts';
import { SENSOR_RING_PX } from '../../config/constants';
import { SensorDot } from './SensorDot';
import type { BodyDotModel } from './bodyViewerModel';

/** Half of the ring box: the dot's center sits this fraction of the box from its edge. */
const HALF = 0.5;

export interface SensorCalloutProps {
  dot: BodyDotModel;
  /** Called with the sensor key when the dot is tapped. Omit it for a non-interactive dot. */
  onSensorTap?: (sensor: SensorKey) => void;
}

/**
 * A sensor dot with its leader and status label, for one body anchor point. The caller places this
 * element's top-left corner on the anchor (a 3D point in `BodyViewer`, a % position in
 * `BodyFallback`). The offset moves the dot's center onto that point, so the dot sits exactly on the
 * anchor; the leader and label then run outward on `labelSide` (the screen side away from the body centre).
 */
export function SensorCallout({ dot, onSensorTap }: SensorCalloutProps) {
  const half = `${SENSOR_RING_PX * HALF}px`;
  const transform =
    dot.labelSide === 'left' ? `translate(calc(-100% + ${half}), -50%)` : `translate(-${half}, -50%)`;

  return (
    <div className="flex items-center" style={{ transform }}>
      <SensorDot
        sensor={dot.sensor}
        level={dot.level}
        reason={dot.reason}
        teamCriterion={dot.teamCriterion}
        focused={dot.focused}
        measuring={dot.measuring}
        onSensorTap={onSensorTap}
        labelSide={dot.labelSide}
      />
    </div>
  );
}
