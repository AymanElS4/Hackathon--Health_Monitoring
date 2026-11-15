import { z } from 'zod';
import {
  DemoScenarioId,
  Indicator,
  Level,
  SensorKey,
  SensorPhase,
  Source,
  Symptom,
  Verdict,
} from './enums';

// Entity schemas from specs/001-chequeo-diario-voz-cuerpo/data-model.md.
// Each schema is paired with an inferred type of the same name.
// Spanish text never lives here; only keys (e.g. `actionKey`, `titleKey`).

/** Blood pressure value in mmHg. */
export const BloodPressure = z.object({
  systolic: z.number().finite(),
  diastolic: z.number().finite(),
});
export type BloodPressure = z.infer<typeof BloodPressure>;

const ObservationBase = z.object({
  source: Source,
  /** Voice values MUST be `true` before saving (Principle IX). Device values are `true` on arrival. */
  confirmed: z.boolean(),
  /** `true` for every device value in this version. */
  simulated: z.boolean(),
  /** ISO date-time. */
  at: z.string().datetime(),
});

// One branch per indicator so `value` is checked against the right shape.
// Plausibility of device values (HR, SpO2, temperature, BP) is NOT checked here;
// it belongs to the device adapter (out of range -> `unknown`).
const SleepHoursObservation = ObservationBase.extend({
  indicator: z.literal('sleep_hours'),
  /** 0–16 hours in 0.5 steps (RN4). */
  value: z
    .number()
    .finite()
    .min(0)
    .max(16)
    .refine((v) => Number.isInteger(v * 2), { message: 'sleep_hours must be in 0.5 steps' }),
});

const MoodObservation = ObservationBase.extend({
  indicator: z.literal('mood'),
  /** Integer 1–5 (RN4). */
  value: z.number().int().min(1).max(5),
});

const BloodPressureObservation = ObservationBase.extend({
  indicator: z.literal('blood_pressure'),
  value: BloodPressure,
});

const NumericObservation = <I extends 'resting_heart_rate' | 'body_temperature' | 'oxygen_saturation'>(
  indicator: I,
) =>
  ObservationBase.extend({
    indicator: z.literal(indicator),
    value: z.number().finite(),
  });

/** One value captured during a check-in. `value` shape depends on `indicator`. */
export const Observation = z.discriminatedUnion('indicator', [
  SleepHoursObservation,
  MoodObservation,
  BloodPressureObservation,
  NumericObservation('resting_heart_rate'),
  NumericObservation('body_temperature'),
  NumericObservation('oxygen_saturation'),
]);
export type Observation = z.infer<typeof Observation>;

/** Range predicate as data. Both bounds inclusive; an omitted bound is unbounded. */
export const RangeBand = z.object({
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
});
export type RangeBand = z.infer<typeof RangeBand>;

/** Source status of a threshold (Principle VIII). */
export const SourceStatus = z.enum(['cited', 'to_verify', 'team_criterion']);
export type SourceStatus = z.infer<typeof SourceStatus>;

/**
 * Threshold for one indicator (static data in `src/config/thresholds.ts`).
 * `source` (guideline, standard, or paper) is required unless `sourceStatus` is
 * `team_criterion`; a team criterion is shown as "criterio del equipo, no clínico".
 */
export const Threshold = z
  .object({
    indicator: Indicator,
    green: RangeBand,
    amber: RangeBand,
    red: RangeBand,
    /** Consecutive readings needed to make `red` (sleep 3 nights, mood 2 days). */
    consecutiveForRed: z.number().int().positive().optional(),
    source: z.string().min(1).optional(),
    sourceStatus: SourceStatus,
  })
  .superRefine((threshold, ctx) => {
    if (threshold.sourceStatus !== 'team_criterion' && !threshold.source) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source'],
        message: 'source is required unless sourceStatus is team_criterion',
      });
    }
  });
export type Threshold = z.infer<typeof Threshold>;

/** Indicator as used by a baseline: blood pressure is split into systolic and diastolic. */
export const BaselineIndicator = z.enum([
  'sleep_hours',
  'mood',
  'resting_heart_rate',
  'systolic',
  'diastolic',
  'body_temperature',
  'oxygen_saturation',
]);
export type BaselineIndicator = z.infer<typeof BaselineIndicator>;

/** "Tu normal": personal baseline computed from the first 14 days (RN3). */
export const Baseline = z.object({
  indicator: BaselineIndicator,
  mean: z.number().finite(),
  /** Always positive: `max(computed, MIN_SD[indicator])`. */
  sd: z.number().finite().positive(),
  /** `false` while fewer than 14 days of data exist ("Aún aprendo tu normal"). */
  ready: z.boolean(),
});
export type Baseline = z.infer<typeof Baseline>;

/** Only input of the 3D body and the metric cards. */
export const SensorReading = z.object({
  sensor: SensorKey,
  /** Worst level of its indicators. */
  level: Level,
  phase: SensorPhase,
  /** Already formatted for display, e.g. "118/76" or "5 h". */
  value: z.string(),
  outsideNormal: z.boolean(),
  /** The indicator that set `level`; `null` when green. */
  reason: Indicator.nullable(),
});
export type SensorReading = z.infer<typeof SensorReading>;

/** State of the rotatable 3D body view. */
export const BodyView = z.object({
  readings: z.record(SensorKey, SensorReading),
  focus: SensorKey.nullable(),
  verdict: z.union([Verdict, z.literal('pending')]),
});
export type BodyView = z.infer<typeof BodyView>;

/** One stored check-in (IndexedDB store `checks`). */
export const CheckRecord = z
  .object({
    /** ISO date-time; primary key. */
    id: z.string().datetime(),
    observations: z.array(Observation),
    symptoms: z.array(Symptom),
    /** Snapshot at save time. */
    readings: z.record(SensorKey, SensorReading),
    verdict: Verdict,
    /** Key into `src/config/messages.es.ts`; exactly one action (RF9). */
    actionKey: z.string().min(1),
    /** `true` for the 14 seeded history days. */
    simulated: z.boolean(),
  })
  .superRefine((record, ctx) => {
    record.observations.forEach((observation, index) => {
      if (observation.source === 'voice' && !observation.confirmed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['observations', index, 'confirmed'],
          message: 'voice observations must be confirmed before saving (Principle IX)',
        });
      }
    });
  });
export type CheckRecord = z.infer<typeof CheckRecord>;

/** Static agenda item for "Lo próximo" (`src/config/agenda.ts`). */
export const AgendaItem = z.object({
  /** 24-hour time, `HH:mm`. */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** Key into `src/config/messages.es.ts`. */
  titleKey: z.string().min(1),
});
export type AgendaItem = z.infer<typeof AgendaItem>;

/** Mode of the voice recognizer for a scenario (CL1). */
export const VoiceMode = z.enum(['real', 'never_understands']);
export type VoiceMode = z.infer<typeof VoiceMode>;

/** Device values for one scenario; `null` means the device sends no value. */
export const DemoDevices = z.object({
  resting_heart_rate: z.number().finite().nullable(),
  blood_pressure: BloodPressure.nullable(),
  body_temperature: z.number().finite().nullable(),
  oxygen_saturation: z.number().finite().nullable(),
});
export type DemoDevices = z.infer<typeof DemoDevices>;

/** Deterministic demo scenario (`src/config/demoScenarios.ts`, FR-013). */
export const DemoScenario = z.object({
  id: DemoScenarioId,
  devices: DemoDevices,
  /** The two nights before today, in hours. */
  priorNights: z.array(z.number().finite()).length(2),
  voice: VoiceMode,
});
export type DemoScenario = z.infer<typeof DemoScenario>;
