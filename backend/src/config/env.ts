import { z } from 'zod';

// Environment validation for the surgeon sync service. Secrets are never echoed back:
// error messages name the variable and the rule that failed, never its value.

export const DEFAULT_PORT = 3000;
export const MIN_CODE_LENGTH = 12;
export const DEFAULT_CORS_ORIGINS = 'https://base-vital.pages.dev';

const CORS_SEPARATOR = ',';
const REQUIRED_MESSAGE = 'required';
const CODE_LENGTH_MESSAGE = `must be at least ${MIN_CODE_LENGTH} characters`;
const CODES_DIFFER_MESSAGE = 'must differ from SYNC_CODE';

const EnvSchema = z
  .object({
    DATABASE_URL: z
      .string({ required_error: REQUIRED_MESSAGE })
      .url('must be a valid URL'),
    PORT: z.coerce
      .number()
      .int('must be an integer')
      .positive('must be a positive number')
      .default(DEFAULT_PORT),
    SURGEON_ACCESS_CODE: z
      .string({ required_error: REQUIRED_MESSAGE })
      .min(MIN_CODE_LENGTH, CODE_LENGTH_MESSAGE),
    SYNC_CODE: z
      .string({ required_error: REQUIRED_MESSAGE })
      .min(MIN_CODE_LENGTH, CODE_LENGTH_MESSAGE),
    CORS_ORIGINS: z
      .string()
      .default(DEFAULT_CORS_ORIGINS)
      .transform((raw) =>
        raw
          .split(CORS_SEPARATOR)
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      )
      .refine((origins) => origins.length > 0, 'must list at least one origin'),
  })
  .refine(
    (env) =>
      typeof env.SURGEON_ACCESS_CODE !== 'string' ||
      typeof env.SYNC_CODE !== 'string' ||
      env.SURGEON_ACCESS_CODE !== env.SYNC_CODE,
    { message: CODES_DIFFER_MESSAGE, path: ['SURGEON_ACCESS_CODE'] },
  );

export type Env = {
  databaseUrl: string;
  port: number;
  surgeonAccessCode: string;
  syncCode: string;
  corsOrigins: string[];
};

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const list = result.error.issues
      .map((issue) => `${String(issue.path[0] ?? 'environment')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${list}`);
  }
  const data = result.data;
  return {
    databaseUrl: data.DATABASE_URL,
    port: data.PORT,
    surgeonAccessCode: data.SURGEON_ACCESS_CODE,
    syncCode: data.SYNC_CODE,
    corsOrigins: data.CORS_ORIGINS,
  };
}

/** Injection token for the validated environment configuration. */
export const ENV = Symbol('ENV');
