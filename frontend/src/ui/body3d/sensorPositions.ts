/**
 * World positions of the `sensor_*` nodes of the body .glb (T078). This is the only body module
 * that imports three, and it is reached only from `BodyViewer`, so the eagerly loaded fallback
 * keeps three.js out of the main bundle.
 */
import { Vector3, type Object3D } from 'three';
import { SensorKey } from '@base-vital/contracts';
import { sensorNodeName } from './bodyViewerModel';

/**
 * World position of every `sensor_*` node under `root`. Call once, after `root.updateMatrixWorld`.
 * A missing node leaves its sensor out of the result.
 */
export function readSensorPositions(root: Object3D): Partial<Record<SensorKey, Vector3>> {
  const positions: Partial<Record<SensorKey, Vector3>> = {};
  for (const sensor of SensorKey.options) {
    const node = root.getObjectByName(sensorNodeName(sensor));
    if (node) {
      positions[sensor] = node.getWorldPosition(new Vector3());
    }
  }
  return positions;
}
