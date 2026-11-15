import { z } from 'zod';

// Shared enums for the check-in contracts. Each schema is paired with an
// inferred type of the same name. Values are the wire/storage identifiers.

/** Body sensor that a reading belongs to. */
export const SensorKey = z.enum(['sleep', 'pulse', 'pressure', 'temperature', 'oxygen']);
export type SensorKey = z.infer<typeof SensorKey>;

/** Health indicator measured or asked about. */
export const Indicator = z.enum([
  'sleep_hours',
  'mood',
  'resting_heart_rate',
  'blood_pressure',
  'body_temperature',
  'oxygen_saturation',
]);
export type Indicator = z.infer<typeof Indicator>;

/** Level assigned to a value or sensor. */
export const Level = z.enum(['green', 'amber', 'red', 'in_doubt', 'unknown']);
export type Level = z.infer<typeof Level>;

/** Phase of a sensor during the check-in. */
export const SensorPhase = z.enum(['idle', 'asking', 'measuring', 'confirmed', 'in_doubt']);
export type SensorPhase = z.infer<typeof SensorPhase>;

/** Overall verdict shown at the end of a check-in. */
export const Verdict = z.enum(['ok', 'attention', 'alert']);
export type Verdict = z.infer<typeof Verdict>;

/** Where a value came from. */
export const Source = z.enum(['voice', 'device']);
export type Source = z.infer<typeof Source>;

/** Symptom reported by the person. */
export const Symptom = z.enum([
  'dizziness',
  'fainting',
  'chest_pain',
  'shortness_of_breath',
  'none',
]);
export type Symptom = z.infer<typeof Symptom>;

/** Identifier of a deterministic demo scenario. */
export const DemoScenarioId = z.enum([
  'normal',
  'ca4',
  'missing_sensor',
  'low_temp',
  'voice_not_understood',
]);
export type DemoScenarioId = z.infer<typeof DemoScenarioId>;

/** Indicators that each sensor is responsible for. */
export const SENSOR_INDICATORS = {
  sleep: ['sleep_hours', 'mood'],
  pulse: ['resting_heart_rate'],
  pressure: ['blood_pressure'],
  temperature: ['body_temperature'],
  oxygen: ['oxygen_saturation'],
} as const satisfies Record<SensorKey, readonly Indicator[]>;
