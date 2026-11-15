import { z } from 'zod';
import { CheckRecord } from '../shared/contracts';

/** Crew identifier: `crew-` followed by six lowercase letters or digits. */
export const CREW_ID_PATTERN = /^crew-[a-z0-9]{6}$/;

/** First mission day a check can belong to. */
export const MIN_MISSION_DAY = 1;

/**
 * Exclusive bound on the absolute value of any stored number. The column is `numeric(6,2)`, which
 * holds up to 9999.99; any value from 9999.995 upward would round (half up) to 10000.00 and overflow,
 * so 9999.995 itself is rejected.
 */
export const MAX_STORED_ABS_VALUE = 9999.995;

/** Envelope the device sends to `POST /api/v1/checks`. Unknown top-level fields are rejected. */
export const SyncCheck = z
  .object({
    clientCheckId: z.string().uuid(),
    crewId: z.string().regex(CREW_ID_PATTERN),
    kind: z.literal('daily'),
    missionDay: z.number().int().min(MIN_MISSION_DAY),
    check: CheckRecord,
  })
  .strict()
  .superRefine((envelope, ctx) => {
    const seenIndicators = new Set<string>();

    envelope.check.observations.forEach((observation, index) => {
      if (seenIndicators.has(observation.indicator)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['check', 'observations', index, 'indicator'],
          message: 'each indicator may appear only once per check',
        });
      }
      seenIndicators.add(observation.indicator);

      const numbers: number[] =
        typeof observation.value === 'number'
          ? [observation.value]
          : [observation.value.systolic, observation.value.diastolic];

      if (numbers.some((value) => Math.abs(value) >= MAX_STORED_ABS_VALUE)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['check', 'observations', index, 'value'],
          message: `numeric values must satisfy abs < ${MAX_STORED_ABS_VALUE} (numeric(6,2))`,
        });
      }

      if (observation.indicator === 'blood_pressure' && typeof observation.value !== 'number') {
        if (!Number.isInteger(observation.value.systolic) || !Number.isInteger(observation.value.diastolic)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['check', 'observations', index, 'value'],
            message: 'blood pressure must be whole mmHg',
          });
        }
      }
    });
  });
export type SyncCheck = z.infer<typeof SyncCheck>;
