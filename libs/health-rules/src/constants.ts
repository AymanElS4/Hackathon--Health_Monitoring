import type { BaselineIndicator } from '@base-vital/contracts';

/**
 * Minimum standard deviation per baseline indicator ("tu normal", RN3).
 * Keeps a perfectly flat history from producing SD 0. Team criteria, not clinical.
 * Units: sleep h, mood points, resting HR bpm, BP mmHg, temperature °C, SpO₂ %.
 */
export const MIN_SD: Record<BaselineIndicator, number> = {
  sleep_hours: 0.5,
  mood: 0.5,
  resting_heart_rate: 3,
  systolic: 4,
  diastolic: 3,
  body_temperature: 0.2,
  oxygen_saturation: 1,
} satisfies Record<BaselineIndicator, number>;
