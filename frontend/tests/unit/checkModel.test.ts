import { describe, expect, it } from 'vitest';
import {
  MAX_BODY_TRIANGLES,
  MAX_MODEL_BYTES,
  SENSOR_NODE_NAMES,
  SKIN_CLEARANCE_M,
  evaluateModel,
  frontCameraPosition,
  pointSurfaceDistance,
  pointTriangleDistance,
  segmentHitsTriangle,
  sensorHiddenFromCamera,
  transformPoint,
  triangleBounds,
  type Bounds,
  type ModelFacts,
  type Triangle,
  type Vec3,
} from '../../scripts/checkModelRules';

// Unit right triangle in the z = 0 plane: (0,0,0) (1,0,0) (0,1,0). Its hypotenuse is x + y = 1.
const TRIANGLE: Triangle = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
];

// Large square in the z = z0 plane, centred on the z axis (covers x, y in [-1, 1]).
function squareAt(z0: number): Triangle[] {
  return [
    [
      [-1, -1, z0],
      [1, -1, z0],
      [1, 1, z0],
    ],
    [
      [-1, -1, z0],
      [1, 1, z0],
      [-1, 1, z0],
    ],
  ];
}

const FRONT_CAMERA: Vec3 = [0, 0, 3];
const SENSOR_AT_ORIGIN: Vec3 = [0, 0, 0];

const ALL_SENSORS_NEAR = Object.fromEntries(SENSOR_NODE_NAMES.map((name) => [name, 0.002]));

function passingFacts(overrides: Partial<ModelFacts> = {}): ModelFacts {
  return {
    nodeNames: ['body', ...SENSOR_NODE_NAMES],
    bodyTriangleCount: 26756,
    fileBytes: 497000,
    sensorDistancesM: ALL_SENSORS_NEAR,
    sensorsHiddenFromFront: [],
    ...overrides,
  };
}

describe('pointTriangleDistance', () => {
  it('measures the distance to the plane for a point above the triangle interior', () => {
    expect(pointTriangleDistance([0.2, 0.2, 0.02], TRIANGLE)).toBeCloseTo(0.02, 12);
  });

  it('measures the distance to the plane for a point below the triangle interior', () => {
    expect(pointTriangleDistance([0.2, 0.2, -0.01], TRIANGLE)).toBeCloseTo(0.01, 12);
  });

  it('is exact for a point beyond an edge, not just the nearest vertex', () => {
    // (0.6, 0.6, 0.02) lies just outside the hypotenuse x + y = 1. Its nearest vertex (1,0,0)
    // is ~0.72 m away; the true distance to the edge is hypot(0.2 / sqrt(2), 0.02).
    const expected = Math.hypot(0.2 / Math.SQRT2, 0.02);
    expect(pointTriangleDistance([0.6, 0.6, 0.02], TRIANGLE)).toBeCloseTo(expected, 12);
  });

  it('measures the distance to a vertex for a point beyond it', () => {
    expect(pointTriangleDistance([-1, -1, 0], TRIANGLE)).toBeCloseTo(Math.SQRT2, 12);
  });

  it('gives zero for a point on the surface', () => {
    expect(pointTriangleDistance([0.25, 0.25, 0], TRIANGLE)).toBeCloseTo(0, 12);
  });

  it('handles a degenerate (zero-area) triangle through its edges', () => {
    const degenerate: Triangle = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ];
    expect(pointTriangleDistance([3, 0, 0], degenerate)).toBeCloseTo(1, 12);
  });
});

describe('pointSurfaceDistance', () => {
  it('reports a point inside 3 cm of the surface as within the limit', () => {
    const d = pointSurfaceDistance([0.2, 0.2, 0.02], [TRIANGLE]);
    expect(d).toBeCloseTo(0.02, 12);
    expect(d).toBeLessThanOrEqual(0.03);
  });

  it('reports a point more than 3 cm away as outside the limit', () => {
    const d = pointSurfaceDistance([0.2, 0.2, 0.05], [TRIANGLE]);
    expect(d).toBeGreaterThan(0.03);
  });

  it('takes the minimum over all triangles', () => {
    const far: Triangle = [
      [10, 10, 0],
      [11, 10, 0],
      [10, 11, 0],
    ];
    expect(pointSurfaceDistance([0.2, 0.2, 0.01], [far, TRIANGLE])).toBeCloseTo(0.01, 12);
  });

  it('returns Infinity for an empty surface', () => {
    expect(pointSurfaceDistance([0, 0, 0], [])).toBe(Infinity);
  });
});

describe('segmentHitsTriangle', () => {
  it('reports a segment that crosses the triangle', () => {
    expect(segmentHitsTriangle([0.2, 0.2, 1], [0.2, 0.2, -1], TRIANGLE)).toBe(true);
  });

  it('reports a segment that stops short of the triangle', () => {
    expect(segmentHitsTriangle([0.2, 0.2, 1], [0.2, 0.2, 0.5], TRIANGLE)).toBe(false);
  });

  it('reports a segment that crosses the plane outside the triangle', () => {
    expect(segmentHitsTriangle([0.9, 0.9, 1], [0.9, 0.9, -1], TRIANGLE)).toBe(false);
  });

  it('reports a segment parallel to the triangle as not crossing it', () => {
    expect(segmentHitsTriangle([0.2, 0.2, 1], [0.5, 0.2, 1], TRIANGLE)).toBe(false);
  });
});

describe('sensorHiddenFromCamera', () => {
  it('reports a sensor hidden by a synthetic occluding triangle between camera and sensor', () => {
    expect(sensorHiddenFromCamera(SENSOR_AT_ORIGIN, FRONT_CAMERA, squareAt(1))).toBe(true);
  });

  it('reports a sensor as visible when no body triangle is between camera and sensor', () => {
    expect(sensorHiddenFromCamera(SENSOR_AT_ORIGIN, FRONT_CAMERA, [])).toBe(false);
    // A triangle behind the sensor (on the far side from the camera) does not hide it.
    expect(sensorHiddenFromCamera(SENSOR_AT_ORIGIN, FRONT_CAMERA, squareAt(-1))).toBe(false);
  });

  it('ignores the skin the sensor sits on (triangles within 3 mm)', () => {
    expect(SKIN_CLEARANCE_M).toBe(0.003);
    expect(sensorHiddenFromCamera(SENSOR_AT_ORIGIN, FRONT_CAMERA, squareAt(0.002))).toBe(false);
  });

  it('counts a triangle just beyond the 3 mm skin clearance', () => {
    expect(sensorHiddenFromCamera(SENSOR_AT_ORIGIN, FRONT_CAMERA, squareAt(0.01))).toBe(true);
  });
});

describe('frontCameraPosition', () => {
  it('places the camera on +Z at the distance that fits the body height (no depth term)', () => {
    // fov 90 deg, aspect 1, margin 1: half height 1 at tan(45 deg) = 1, so the distance is 1.
    const bounds: Bounds = { min: [-0.5, -1, 0], max: [0.5, 1, 0] };
    const camera = frontCameraPosition(bounds, { verticalFovDeg: 90, aspect: 1, margin: 1 });
    expect(camera[0]).toBeCloseTo(0, 12);
    expect(camera[1]).toBeCloseTo(0, 12);
    expect(camera[2]).toBeCloseTo(1, 12);
  });

  it('adds half the depth and applies the margin', () => {
    const bounds: Bounds = { min: [-0.5, -1, -0.2], max: [0.5, 1, 0.2] };
    const camera = frontCameraPosition(bounds, { verticalFovDeg: 90, aspect: 1, margin: 1.1 });
    // 1 * 1.1 + 0.4 / 2 = 1.3
    expect(camera[2]).toBeCloseTo(1.3, 12);
  });

  it('is measured from the bounds centre of the triangles', () => {
    const tris: Triangle[] = [
      [
        [0, 0, 0],
        [0, 2, 0],
        [0, 0, 2],
      ],
    ];
    const bounds = triangleBounds(tris);
    expect(bounds).toEqual({ min: [0, 0, 0], max: [0, 2, 2] });
    const camera = frontCameraPosition(bounds!, { verticalFovDeg: 90, aspect: 1, margin: 1 });
    expect(camera[0]).toBeCloseTo(0, 12);
    expect(camera[1]).toBeCloseTo(1, 12);
  });
});

describe('front visibility rule in evaluateModel', () => {
  it('fails a sensor that a body triangle hides from the front camera', () => {
    const failures = evaluateModel(passingFacts({ sensorsHiddenFromFront: ['sensor_oxygen'] }));
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('"sensor_oxygen"');
    expect(failures[0]).toContain('hidden from the front camera');
  });
});

describe('transformPoint', () => {
  it('applies translation and scale from a column-major matrix', () => {
    const m = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 5, 6, 7, 1];
    expect(transformPoint(m, [1, 1, 1])).toEqual([7, 8, 9]);
  });
});

describe('evaluateModel', () => {
  it('passes a model that meets every rule', () => {
    expect(evaluateModel(passingFacts())).toEqual([]);
  });

  it('fails when the body node is missing', () => {
    const failures = evaluateModel(
      passingFacts({
        nodeNames: [...SENSOR_NODE_NAMES],
        bodyTriangleCount: null,
        sensorDistancesM: {},
      }),
    );
    expect(failures).toEqual(['missing node "body"']);
  });

  it('fails when the body node has no mesh', () => {
    const failures = evaluateModel(passingFacts({ bodyTriangleCount: null }));
    expect(failures).toEqual(['node "body" has no mesh']);
  });

  it('fails for each missing sensor node and skips its distance', () => {
    const nodeNames = [
      'body',
      'sensor_sleep',
      'sensor_pulse',
      'sensor_pressure',
      'sensor_temperature',
    ];
    const measured: Record<string, number> = { ...ALL_SENSORS_NEAR };
    delete measured.sensor_oxygen;
    const failures = evaluateModel(passingFacts({ nodeNames, sensorDistancesM: measured }));
    expect(failures).toEqual(['missing node "sensor_oxygen"']);
  });

  it('fails when body has more than the triangle budget and passes at exactly the budget', () => {
    expect(evaluateModel(passingFacts({ bodyTriangleCount: MAX_BODY_TRIANGLES + 1 }))).toEqual([
      `"body" has ${MAX_BODY_TRIANGLES + 1} triangles (max ${MAX_BODY_TRIANGLES})`,
    ]);
    expect(evaluateModel(passingFacts({ bodyTriangleCount: MAX_BODY_TRIANGLES }))).toEqual([]);
  });

  it('fails when the file is larger than 3 MiB and passes at exactly 3 MiB', () => {
    expect(evaluateModel(passingFacts({ fileBytes: MAX_MODEL_BYTES + 1 }))).toHaveLength(1);
    expect(evaluateModel(passingFacts({ fileBytes: MAX_MODEL_BYTES }))).toEqual([]);
  });

  it('fails a sensor farther than 3 cm from the surface and passes one at exactly 3 cm', () => {
    const far = evaluateModel(
      passingFacts({ sensorDistancesM: { ...ALL_SENSORS_NEAR, sensor_pulse: 0.031 } }),
    );
    expect(far).toHaveLength(1);
    expect(far[0]).toContain('"sensor_pulse"');
    expect(
      evaluateModel(
        passingFacts({ sensorDistancesM: { ...ALL_SENSORS_NEAR, sensor_pulse: 0.03 } }),
      ),
    ).toEqual([]);
  });

  it('lists every failure together', () => {
    const failures = evaluateModel(
      passingFacts({
        nodeNames: ['body', 'sensor_sleep'],
        bodyTriangleCount: MAX_BODY_TRIANGLES + 1,
        fileBytes: MAX_MODEL_BYTES + 1,
        sensorDistancesM: { sensor_sleep: 0.05 },
      }),
    );
    // 4 missing sensors + triangle budget + file size + one sensor distance.
    expect(failures).toHaveLength(7);
  });
});
