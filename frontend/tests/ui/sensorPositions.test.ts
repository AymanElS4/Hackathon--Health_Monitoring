/**
 * Tests for `readSensorPositions` (T078): the world position of each `sensor_*` node of the body
 * .glb. Moved out of `bodyViewerModel.test.ts` with the three.js import it needs.
 */
import { describe, it, expect } from 'vitest';
import { Group, Object3D, Vector3 } from 'three';
import { readSensorPositions } from '../../src/ui/body3d/sensorPositions';
import { sensorNodeName } from '../../src/ui/body3d/bodyViewerModel';

describe('readSensorPositions', () => {
  it('returns the world position of each sensor_* node', () => {
    const root = new Group();
    const parent = new Group();
    parent.position.set(1, 0, 0);
    root.add(parent);
    const pulse = new Object3D();
    pulse.name = 'sensor_pulse';
    pulse.position.set(0.1, 1.2, 0.05);
    parent.add(pulse);
    root.updateMatrixWorld(true);

    const positions = readSensorPositions(root);
    expect(positions.pulse?.x).toBeCloseTo(1.1);
    expect(positions.pulse?.y).toBeCloseTo(1.2);
    expect(positions.pulse?.z).toBeCloseTo(0.05);
  });

  it('leaves out a sensor whose node is missing', () => {
    const root = new Group();
    root.updateMatrixWorld(true);
    expect(readSensorPositions(root)).toEqual({});
  });

  it('returns a Vector3 for each present sensor', () => {
    const root = new Group();
    const oxygen = new Object3D();
    oxygen.name = sensorNodeName('oxygen');
    oxygen.position.set(-0.4, 0.9, 0);
    root.add(oxygen);
    root.updateMatrixWorld(true);
    expect(readSensorPositions(root).oxygen).toBeInstanceOf(Vector3);
  });
});
