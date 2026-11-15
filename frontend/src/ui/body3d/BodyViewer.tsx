import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import type { SensorKey } from '@base-vital/contracts';
import {
  BODY_AZIMUTH_LIMIT_RAD,
  BODY_CAMERA_FOV_DEG,
  BODY_DRACO_PATH,
  BODY_FIT_MARGIN,
  BODY_LABEL_Z_INDEX_RANGE,
  BODY_MODEL_URL,
  BODY_POLAR_ANGLE_RAD,
} from '../../config/constants';
import { SensorCallout } from './SensorCallout';
import { bodyDotModels, cameraDistanceToFit, type BodyReading } from './bodyViewerModel';
import { readSensorPositions } from './sensorPositions';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Soft lighting: ambient fill plus one key light from the upper front. */
const AMBIENT_INTENSITY = 0.9;
/** Key light: direction in scene units (right, up, toward the front) and intensity. */
const KEY_LIGHT = { x: 1, y: 2, z: 3, intensity: 0.6 };

/** Name of the body mesh node in the .glb (contracts/body-glb.md). */
const BODY_MESH_NAME = 'body';

/** Start the Draco-compressed model download as soon as this module loads. */
useGLTF.preload(BODY_MODEL_URL, BODY_DRACO_PATH);

export interface BodyViewerProps {
  /** Sensor readings of the check or of Home. A sensor with no reading is shown as unknown. */
  readings: readonly BodyReading[];
  /** Sensor being discussed (halo), or null. */
  focus: SensorKey | null;
  /** Called with the sensor key when a dot is tapped. Omit it for non-interactive dots. */
  onSensorTap?: (sensor: SensorKey) => void;
  /** True while the focused sensor is being measured (spinner on its dot). */
  measuring?: boolean;
  /**
   * False before the check is evaluated: every dot is then a plain identity dot (no level, no pill).
   * True once the verdict exists, when the levels and the "sin dato" dots are shown.
   */
  evaluated: boolean;
  /** Called once, after the body model is loaded and drawn. Lets the caller drop the fallback. */
  onLoaded?: () => void;
}

/**
 * The 3D body with one sensor dot per sensor (ui-build §3 #2, RF6). Rotates around the vertical
 * axis within ±60° only: no zoom, no pan, no auto-rotate. The Canvas background is transparent, and
 * its wrapper does not clip, so a label on the body's edge can extend past the viewer.
 * The WebGL check, load timeout and fallback switch live in `LazyBodyViewer` (T079).
 */
export function BodyViewer({
  readings,
  focus,
  onSensorTap,
  measuring = false,
  evaluated,
  onLoaded,
}: BodyViewerProps) {
  return (
    <Canvas
      camera={{ fov: BODY_CAMERA_FOV_DEG }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        gl.setClearAlpha(0);
      }}
      // R3F's wrapper clips with `overflow: hidden`; the labels are DOM, so they may leave the canvas.
      style={{ background: 'transparent', overflow: 'visible' }}
    >
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <directionalLight position={[KEY_LIGHT.x, KEY_LIGHT.y, KEY_LIGHT.z]} intensity={KEY_LIGHT.intensity} />
      <BodyScene
        readings={readings}
        focus={focus}
        onSensorTap={onSensorTap}
        measuring={measuring}
        evaluated={evaluated}
        onLoaded={onLoaded}
      />
    </Canvas>
  );
}

function BodyScene({ readings, focus, onSensorTap, measuring = false, evaluated, onLoaded }: BodyViewerProps) {
  const { scene } = useGLTF(BODY_MODEL_URL, BODY_DRACO_PATH);
  const viewport = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const notifiedLoaded = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  // `useGLTF` suspends until the model is ready, so this effect runs once the body is drawn.
  useEffect(() => {
    if (!notifiedLoaded.current) {
      notifiedLoaded.current = true;
      onLoaded?.();
    }
  }, [scene, onLoaded]);

  // Read once per loaded model: the sensor nodes do not move, and the body is fitted to its bounds.
  const { center, bodySize } = useMemo(() => {
    scene.updateMatrixWorld(true);
    const body = scene.getObjectByName(BODY_MESH_NAME) ?? scene;
    const box = new Box3().setFromObject(body);
    return { center: box.getCenter(new Vector3()), bodySize: box.getSize(new Vector3()) };
  }, [scene]);

  const sensorPositions = useMemo(() => {
    scene.updateMatrixWorld(true);
    return readSensorPositions(scene);
  }, [scene]);

  // Portrait framing: straight-on camera at the body center, distance set so the body fits.
  useEffect(() => {
    const aspect = viewport.width / viewport.height;
    const distance = cameraDistanceToFit(bodySize, BODY_CAMERA_FOV_DEG, aspect, BODY_FIT_MARGIN);
    camera.position.set(center.x, center.y, center.z + distance);
    camera.lookAt(center);
  }, [camera, center, bodySize, viewport.width, viewport.height]);

  const dots = bodyDotModels(readings, focus, measuring, evaluated);

  return (
    <>
      <primitive object={scene} />
      <OrbitControls
        makeDefault
        target={center}
        enableDamping={!reducedMotion}
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        minAzimuthAngle={-BODY_AZIMUTH_LIMIT_RAD}
        maxAzimuthAngle={BODY_AZIMUTH_LIMIT_RAD}
        minPolarAngle={BODY_POLAR_ANGLE_RAD}
        maxPolarAngle={BODY_POLAR_ANGLE_RAD}
      />
      {dots.map((dot) => {
        const position = sensorPositions[dot.sensor];
        // A missing sensor node is not drawn; scripts/check-model.ts guards the node names.
        return position ? (
          <Html key={dot.sensor} position={position} occlude zIndexRange={BODY_LABEL_Z_INDEX_RANGE}>
            <SensorCallout dot={dot} onSensorTap={onSensorTap} />
          </Html>
        ) : null;
      })}
    </>
  );
}
