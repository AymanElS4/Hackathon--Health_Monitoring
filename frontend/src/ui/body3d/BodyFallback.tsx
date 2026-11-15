import { BODY_FALLBACK_SIZE, BODY_FALLBACK_URL, FALLBACK_DOTS } from '../../config/constants';
import { t } from '../../config/messages.es';
import type { BodyViewerProps } from './BodyViewer';
import { SensorCallout } from './SensorCallout';
import { bodyDotModels } from './bodyViewerModel';

/** Same inputs as `BodyViewer`, minus the load signal the fallback never sends. */
export type BodyFallbackProps = Omit<BodyViewerProps, 'onLoaded'>;

/**
 * The 2D stand-in for the 3D body (CL5, ui-build §3 #2): the local `body-fallback.png` with one sensor
 * dot per sensor at its `FALLBACK_DOTS` position. The overlay box has the image's aspect ratio, so the
 * % positions land on the same spots as the image.
 */
export function BodyFallback({ readings, focus, onSensorTap, measuring = false, evaluated }: BodyFallbackProps) {
  const dots = bodyDotModels(readings, focus, measuring, evaluated);

  // Sized by height: the parent fixes it, and the aspect ratio gives the width.
  return (
    <div
      className="relative h-full"
      style={{ aspectRatio: `${BODY_FALLBACK_SIZE.width} / ${BODY_FALLBACK_SIZE.height}` }}
    >
      <img
        src={BODY_FALLBACK_URL}
        alt={t('body.fallbackAlt')}
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
      />
      {dots.map((dot) => {
        const anchor = FALLBACK_DOTS[dot.sensor];
        return (
          <div
            key={dot.sensor}
            data-sensor-anchor={dot.sensor}
            className="absolute"
            style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
          >
            <SensorCallout dot={dot} onSensorTap={onSensorTap} />
          </div>
        );
      })}
    </div>
  );
}
