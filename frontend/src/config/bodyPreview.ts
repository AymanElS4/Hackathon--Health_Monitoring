import type { SensorKey } from '@base-vital/contracts';

export const BODY_CAMERA_POSITION: [number, number, number] = [0, 1.45, 7];
export const BODY_CAMERA_TARGET: [number, number, number] = [0, 1.25, 0];
export const BODY_ORBIT_LIMITS = {
  minPolarAngle: 0.35,
  maxPolarAngle: 2.75,
};

interface BodyPart {
  position: [number, number, number];
  scale: [number, number, number];
}

export const BODY_PARTS = {
  head: { position: [0, 2.48, 0], scale: [0.39, 0.47, 0.34] },
  neck: { position: [0, 1.98, 0], scale: [0.17, 0.24, 0.17] },
  shoulders: { position: [0, 1.82, 0], scale: [0.67, 0.26, 0.31] },
  torso: { position: [0, 1.28, 0], scale: [0.4, 0.74, 0.28] },
  pelvis: { position: [0, 0.71, 0], scale: [0.42, 0.28, 0.28] },
  upperArmLeft: { position: [-0.69, 1.4, 0], scale: [0.16, 0.5, 0.16] },
  upperArmRight: { position: [0.69, 1.4, 0], scale: [0.16, 0.5, 0.16] },
  forearmLeft: { position: [-0.84, 0.89, 0], scale: [0.13, 0.43, 0.13] },
  forearmRight: { position: [0.84, 0.89, 0], scale: [0.13, 0.43, 0.13] },
  handLeft: { position: [-0.89, 0.43, 0.03], scale: [0.14, 0.17, 0.12] },
  handRight: { position: [0.89, 0.43, 0.03], scale: [0.14, 0.17, 0.12] },
  upperLegLeft: { position: [-0.23, 0.16, 0], scale: [0.19, 0.65, 0.19] },
  upperLegRight: { position: [0.23, 0.16, 0], scale: [0.19, 0.65, 0.19] },
  lowerLegLeft: { position: [-0.24, -0.55, 0], scale: [0.15, 0.55, 0.15] },
  lowerLegRight: { position: [0.24, -0.55, 0], scale: [0.15, 0.55, 0.15] },
  footLeft: { position: [-0.24, -1.02, 0.08], scale: [0.18, 0.13, 0.27] },
  footRight: { position: [0.24, -1.02, 0.08], scale: [0.18, 0.13, 0.27] },
} satisfies Record<string, BodyPart>;

export const BODY_SENSOR_POSITIONS: Record<SensorKey, [number, number, number]> = {
  sleep: [0, 2.54, 0.37],
  pulse: [-0.13, 1.47, 0.35],
  pressure: [0.88, 1.42, 0.1],
  temperature: [0, 0.94, 0.31],
  oxygen: [0.9, 0.44, 0.1],
};

export const BODY_DASHED_RING_POINTS: [number, number, number][] = [
  [0, 0.15, 0],
  [0.11, 0.11, 0],
  [0.15, 0, 0],
  [0.11, -0.11, 0],
  [0, -0.15, 0],
  [-0.11, -0.11, 0],
  [-0.15, 0, 0],
  [-0.11, 0.11, 0],
];

export const BODY_SPHERE_GEOMETRY: [number, number, number] = [1, 24, 18];
export const BODY_DOT_GEOMETRY: [number, number, number] = [0.075, 16, 12];
export const BODY_RING_GEOMETRY: [number, number, number, number] = [0.12, 0.018, 8, 24];
export const BODY_DASH_DOT_GEOMETRY: [number, number, number] = [0.026, 8, 6];
export const BODY_DPR: [number, number] = [1, 1.5];
export const BODY_SELECTED_SCALE = 1.18;
export const BODY_CAMERA_FOV = 34;
export const BODY_AMBIENT_INTENSITY = 1.5;
export const BODY_KEY_LIGHT_INTENSITY = 2;
export const BODY_FILL_LIGHT_INTENSITY = 0.75;
export const BODY_HTML_DISTANCE_FACTOR = 8;
export const BODY_MATERIAL_ROUGHNESS = 0.68;
export const BODY_MATERIAL_METALNESS = 0.015;
export const BODY_EMISSIVE_INTENSITY = 0.22;

export const BODY_LIGHT_POSITIONS: [number, number, number][] = [
  [-3, 5, 6],
  [4, 2, 3],
];

export const BODY_RING_LABEL_OFFSET: [number, number, number] = [0, 0.2, 0];
export const BODY_MODEL_COLOR = '#D9DDE2';
export const BODY_UNLIT_COLOR = '#000000';
