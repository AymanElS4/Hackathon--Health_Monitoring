/**
 * Tests for the pure logic behind `BodyViewer` (T078). No WebGL and no three.js: everything the viewer
 * decides lives in `bodyViewerModel.ts` and is tested here. The node positions are tested in
 * `sensorPositions.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { SensorKey } from '@base-vital/contracts';
import {
  bodyDotModels,
  cameraDistanceToFit,
  labelSideOf,
  sensorNodeName,
  type BodyReading,
} from '../../src/ui/body3d/bodyViewerModel';

const reading = (sensor: SensorKey, overrides: Partial<BodyReading> = {}): BodyReading => ({
  sensor,
  level: 'amber',
  reason: 'sleep_hours',
  teamCriterion: false,
  ...overrides,
});

const ALL_READINGS: BodyReading[] = SensorKey.options.map((sensor) => reading(sensor, { level: 'green', reason: null }));

describe('bodyDotModels', () => {
  it('returns one model per SensorKey, in SensorKey order', () => {
    const models = bodyDotModels([], null, false, true);
    expect(models.map((m) => m.sensor)).toEqual([...SensorKey.options]);
  });

  it('maps a reading to the dot level, reason and team criterion once evaluated', () => {
    const models = bodyDotModels(
      [reading('pulse', { level: 'red', reason: 'resting_heart_rate', teamCriterion: true })],
      null,
      false,
      true,
    );
    const pulse = models.find((m) => m.sensor === 'pulse');
    expect(pulse).toMatchObject({ level: 'red', reason: 'resting_heart_rate', teamCriterion: true });
  });

  it('renders a sensor with no reading as unknown with no reason once evaluated', () => {
    const models = bodyDotModels([reading('sleep')], null, false, true);
    for (const sensor of SensorKey.options.filter((s) => s !== 'sleep')) {
      expect(models.find((m) => m.sensor === sensor)).toMatchObject({
        level: 'unknown',
        reason: null,
        teamCriterion: false,
      });
    }
  });

  it('evaluated without a pressure reading: the pressure dot is unknown, the others keep their level', () => {
    const models = bodyDotModels(ALL_READINGS.filter((r) => r.sensor !== 'pressure'), null, false, true);
    expect(models.find((m) => m.sensor === 'pressure')).toMatchObject({ level: 'unknown', reason: null });
    expect(models.find((m) => m.sensor === 'pulse')).toMatchObject({ level: 'green' });
  });

  it('before evaluation every dot has level null, even with readings', () => {
    const models = bodyDotModels([reading('pulse', { level: 'red' }), reading('sleep')], 'pulse', false, false);
    expect(models.map((m) => m.level)).toEqual(SensorKey.options.map(() => null));
    expect(models.every((m) => m.reason === null && m.teamCriterion === false)).toBe(true);
  });

  it('keeps focus and measuring before evaluation (the identity dot can still be focused)', () => {
    const models = bodyDotModels([], 'sleep', true, false);
    expect(models.find((m) => m.sensor === 'sleep')).toMatchObject({ focused: true, measuring: true, level: null });
  });

  it('marks only the focused sensor as focused', () => {
    const models = bodyDotModels([], 'oxygen', false, true);
    expect(models.filter((m) => m.focused).map((m) => m.sensor)).toEqual(['oxygen']);
  });

  it('shows the measuring spinner only on the focused sensor', () => {
    const measuringFocus = bodyDotModels([], 'temperature', true, true);
    expect(measuringFocus.filter((m) => m.measuring).map((m) => m.sensor)).toEqual(['temperature']);

    const measuringNoFocus = bodyDotModels([], null, true, true);
    expect(measuringNoFocus.some((m) => m.measuring)).toBe(false);
  });

  it('shows no spinner and no focus when not measuring and nothing is focused', () => {
    const models = bodyDotModels([], null, false, true);
    expect(models.some((m) => m.measuring || m.focused)).toBe(false);
  });
});

describe('labelSideOf', () => {
  it('puts the pressure and oxygen labels on the left (the body is on the right of the screen)', () => {
    expect(labelSideOf('pressure')).toBe('left');
    expect(labelSideOf('oxygen')).toBe('left');
  });

  it('puts the sleep, pulse and temperature labels on the right', () => {
    expect(labelSideOf('sleep')).toBe('right');
    expect(labelSideOf('pulse')).toBe('right');
    expect(labelSideOf('temperature')).toBe('right');
  });

  it('is carried into every dot model', () => {
    for (const model of bodyDotModels([], null, false, true)) {
      expect(model.labelSide).toBe(labelSideOf(model.sensor));
    }
  });
});

describe('sensorNodeName', () => {
  it('builds the glb node name sensor_<key> (contracts/body-glb.md)', () => {
    expect(sensorNodeName('pulse')).toBe('sensor_pulse');
    expect(sensorNodeName('temperature')).toBe('sensor_temperature');
  });
});

describe('cameraDistanceToFit', () => {
  it('fits the body height to the vertical field of view', () => {
    // tan(90° / 2) = 1, so half the height (1) at distance 1 fills the frame exactly.
    const distance = cameraDistanceToFit({ x: 0, y: 2, z: 0 }, 90, 1, 1);
    expect(distance).toBeCloseTo(1);
  });

  it('moves the camera farther for a taller body', () => {
    const short = cameraDistanceToFit({ x: 0.5, y: 1, z: 0.3 }, 30, 0.6, 1.1);
    const tall = cameraDistanceToFit({ x: 0.5, y: 2, z: 0.3 }, 30, 0.6, 1.1);
    expect(tall).toBeGreaterThan(short);
  });

  it('moves the camera farther when the viewport is narrower, so the width still fits', () => {
    const wide = cameraDistanceToFit({ x: 1.2, y: 2, z: 0.3 }, 30, 1.5, 1.1);
    const narrow = cameraDistanceToFit({ x: 1.2, y: 2, z: 0.3 }, 30, 0.4, 1.1);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('adds the margin factor', () => {
    const tight = cameraDistanceToFit({ x: 0, y: 2, z: 0 }, 90, 1, 1);
    const loose = cameraDistanceToFit({ x: 0, y: 2, z: 0 }, 90, 1, 1.2);
    expect(loose).toBeCloseTo(tight * 1.2);
  });
});
