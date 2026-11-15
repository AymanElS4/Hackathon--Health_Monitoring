/**
 * Pure rules for the 3D body asset check (contracts/body-glb.md). No I/O here: `check-model.ts`
 * reads the GLB, measures it and hands the facts to `evaluateModel`.
 */

export const BODY_NODE_NAME = 'body';
export const SENSOR_NODE_NAMES = [
  'sensor_sleep',
  'sensor_pulse',
  'sensor_pressure',
  'sensor_temperature',
  'sensor_oxygen',
] as const;

export const MAX_BODY_TRIANGLES = 30000;
const BYTES_PER_KIB = 1024;
export const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;
export const MAX_MODEL_MIB = 3;
export const MAX_MODEL_BYTES = MAX_MODEL_MIB * BYTES_PER_MIB;
export const MAX_SENSOR_DISTANCE_M = 0.03;
export const MM_PER_M = 1000;
export const MM_DECIMALS = 1;

export type Vec3 = readonly [number, number, number];
export type Triangle = readonly [Vec3, Vec3, Vec3];
/** Column-major 4x4 matrix, as in glTF and gl-matrix. */
export type Mat4 = readonly number[];

/** Body triangles this close to a sensor are the skin it sits on, so they never hide it. */
export const SKIN_CLEARANCE_M = 0.003;
/** Determinant below which a segment counts as parallel to a triangle (Möller-Trumbore). */
const RAY_PARALLEL_EPSILON = 1e-12;
const AXES = 3;
const HALF = 0.5;
const HALF_TURN_DEG = 180;

export interface ModelFacts {
  /** Names of every node in the file, whatever its type. */
  readonly nodeNames: readonly string[];
  /** Triangles of the `body` node; `null` when the node has no mesh. Ignored when `body` is missing. */
  readonly bodyTriangleCount: number | null;
  readonly fileBytes: number;
  /** World-space distance in meters from each present sensor node to the body surface. */
  readonly sensorDistancesM: Readonly<Partial<Record<string, number>>>;
  /** Names of the present sensor nodes that a `body` triangle hides from the front camera. */
  readonly sensorsHiddenFromFront: readonly string[];
}

export interface Bounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** Framing of the viewer (`BODY_CAMERA_FOV_DEG`, `BODY_FIT_MARGIN`) and the fallback aspect. */
export interface FrontFraming {
  readonly verticalFovDeg: number;
  readonly aspect: number;
  readonly margin: number;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  return [ax - bx, ay - by, az - bz];
}

function dot(a: Vec3, b: Vec3): number {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  return ax * bx + ay * by + az * bz;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

/** Distance from point `p` to the closed segment `a`-`b`. */
function pointSegmentDistance(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a);
  const abLengthSq = dot(ab, ab);
  if (abLengthSq === 0) return length(sub(p, a));
  const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / abLengthSq));
  const closest: Vec3 = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
  return length(sub(p, closest));
}

/**
 * Exact distance from `p` to the closed triangle `tri` (not just to its vertices).
 * Inside the triangle it is the distance to its plane; outside, the nearest of its three edges.
 */
export function pointTriangleDistance(p: Vec3, tri: Triangle): number {
  const [a, b, c] = tri;
  const normal = cross(sub(b, a), sub(c, a));
  const normalLength = length(normal);
  if (normalLength > 0) {
    // The sign of cross(edge, p - edgeStart) . normal is the same for p and for its projection
    // onto the plane, so the inside test can use p directly.
    const insideEdgeAB = dot(cross(sub(b, a), sub(p, a)), normal) >= 0;
    const insideEdgeBC = dot(cross(sub(c, b), sub(p, b)), normal) >= 0;
    const insideEdgeCA = dot(cross(sub(a, c), sub(p, c)), normal) >= 0;
    if (insideEdgeAB && insideEdgeBC && insideEdgeCA) {
      return Math.abs(dot(sub(p, a), normal)) / normalLength;
    }
  }
  return Math.min(
    pointSegmentDistance(p, a, b),
    pointSegmentDistance(p, b, c),
    pointSegmentDistance(p, c, a),
  );
}

/** Minimum distance from `p` to any triangle of a surface; `Infinity` for an empty surface. */
export function pointSurfaceDistance(p: Vec3, triangles: readonly Triangle[]): number {
  let best = Infinity;
  for (const tri of triangles) {
    const d = pointTriangleDistance(p, tri);
    if (d < best) best = d;
  }
  return best;
}

/** Applies a column-major 4x4 transform to a point (w = 1). */
export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** True when the closed segment `a`-`b` crosses the closed triangle `tri` (Möller-Trumbore). */
export function segmentHitsTriangle(a: Vec3, b: Vec3, tri: Triangle): boolean {
  const [v0, v1, v2] = tri;
  const edge1 = sub(v1, v0);
  const edge2 = sub(v2, v0);
  const direction = sub(b, a);
  const p = cross(direction, edge2);
  const det = dot(edge1, p);
  if (Math.abs(det) < RAY_PARALLEL_EPSILON) return false;
  const inverse = 1 / det;
  const s = sub(a, v0);
  const u = dot(s, p) * inverse;
  if (u < 0 || u > 1) return false;
  const q = cross(s, edge1);
  const v = dot(direction, q) * inverse;
  if (v < 0 || u + v > 1) return false;
  const t = dot(edge2, q) * inverse;
  return t >= 0 && t <= 1;
}

/**
 * True when a body triangle lies between `camera` and `sensor`, so the front camera cannot see the
 * sensor. Triangles within SKIN_CLEARANCE_M of the sensor are the skin it sits on and are skipped.
 */
export function sensorHiddenFromCamera(
  sensor: Vec3,
  camera: Vec3,
  triangles: readonly Triangle[],
): boolean {
  return triangles.some(
    (tri) =>
      pointTriangleDistance(sensor, tri) > SKIN_CLEARANCE_M &&
      segmentHitsTriangle(camera, sensor, tri),
  );
}

/** Axis-aligned bounds of a set of triangles; `null` when there are none. */
export function triangleBounds(triangles: readonly Triangle[]): Bounds | null {
  if (triangles.length === 0) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const tri of triangles) {
    for (const p of tri) {
      for (let axis = 0; axis < AXES; axis += 1) {
        if (p[axis] < min[axis]) min[axis] = p[axis];
        if (p[axis] > max[axis]) max[axis] = p[axis];
      }
    }
  }
  return { min, max };
}

/**
 * Front camera of the viewer: on +Z, looking at the bounds centre, at the distance that fits the
 * body. Same formula as `cameraDistanceToFit` in `frontend/src/ui/body3d/bodyViewerModel.ts`
 * (glTF y is the height, x the width, z the depth).
 */
export function frontCameraPosition(bounds: Bounds, framing: FrontFraming): Vec3 {
  const size = sub(bounds.max, bounds.min);
  const center: Vec3 = [
    (bounds.min[0] + bounds.max[0]) * HALF,
    (bounds.min[1] + bounds.max[1]) * HALF,
    (bounds.min[2] + bounds.max[2]) * HALF,
  ];
  const halfTan = Math.tan(((framing.verticalFovDeg * Math.PI) / HALF_TURN_DEG) * HALF);
  const byHeight = (size[1] * HALF) / halfTan;
  const byWidth = (size[0] * HALF) / (halfTan * framing.aspect);
  const distance = Math.max(byHeight, byWidth) * framing.margin + size[2] * HALF;
  return [center[0], center[1], center[2] + distance];
}

/**
 * Applies every rule of contracts/body-glb.md and returns one message per failure, in rule order.
 * An empty array means the model passes.
 */
export function evaluateModel(facts: ModelFacts): string[] {
  const failures: string[] = [];
  const names = new Set(facts.nodeNames);

  const bodyPresent = names.has(BODY_NODE_NAME);
  if (!bodyPresent) {
    failures.push(`missing node "${BODY_NODE_NAME}"`);
  } else if (facts.bodyTriangleCount === null) {
    failures.push(`node "${BODY_NODE_NAME}" has no mesh`);
  } else if (facts.bodyTriangleCount > MAX_BODY_TRIANGLES) {
    failures.push(
      `"${BODY_NODE_NAME}" has ${facts.bodyTriangleCount} triangles (max ${MAX_BODY_TRIANGLES})`,
    );
  }

  for (const sensor of SENSOR_NODE_NAMES) {
    if (!names.has(sensor)) failures.push(`missing node "${sensor}"`);
  }

  if (facts.fileBytes > MAX_MODEL_BYTES) {
    failures.push(`file is ${facts.fileBytes} bytes (max ${MAX_MODEL_BYTES})`);
  }

  for (const sensor of SENSOR_NODE_NAMES) {
    const distance = facts.sensorDistancesM[sensor];
    if (distance !== undefined && distance > MAX_SENSOR_DISTANCE_M) {
      failures.push(
        `"${sensor}" is ${(distance * MM_PER_M).toFixed(MM_DECIMALS)} mm from the body surface ` +
          `(max ${MAX_SENSOR_DISTANCE_M * MM_PER_M} mm)`,
      );
    }
  }

  for (const sensor of SENSOR_NODE_NAMES) {
    if (facts.sensorsHiddenFromFront.includes(sensor)) {
      failures.push(
        `"${sensor}" is hidden from the front camera (+Z): a "${BODY_NODE_NAME}" triangle is between them`,
      );
    }
  }

  return failures;
}
