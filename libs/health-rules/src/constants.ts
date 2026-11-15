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

/**
 * Days of history that form "tu normal": the mean and SD are taken from the first 14 days only
 * and fixed afterwards (RN3). Team criterion, not clinical.
 */
export const BASELINE_DAYS = 14;

/**
 * A value is outside normal when it is more than this many SD away from the baseline mean
 * (RN3). Team criterion, not clinical.
 */
export const OUTSIDE_NORMAL_SD = 2;

/**
 * Consecutive check-ins (today included) that must all be outside normal (RN3). Team criterion,
 * not clinical.
 */
export const OUTSIDE_NORMAL_READINGS = 3;
