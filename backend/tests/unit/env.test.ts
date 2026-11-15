import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/basevital';
const SURGEON_ACCESS_CODE = 'surgeon-code-123';
const SYNC_CODE = 'sync-code-4567890';
const DEFAULT_CORS = 'https://base-vital.pages.dev';

function validSource(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL,
    SURGEON_ACCESS_CODE,
    SYNC_CODE,
    ...overrides,
  };
}

describe('loadEnv', () => {
  it('returns camelCase config for a valid environment', () => {
    const env = loadEnv(validSource({ PORT: '8080', CORS_ORIGINS: 'https://a.test,https://b.test' }));
    expect(env).toEqual({
      databaseUrl: DATABASE_URL,
      port: 8080,
      surgeonAccessCode: SURGEON_ACCESS_CODE,
      syncCode: SYNC_CODE,
      corsOrigins: ['https://a.test', 'https://b.test'],
    });
  });

  it('names every required variable when all are missing', () => {
    let message = '';
    try {
      loadEnv({});
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^Invalid configuration: /);
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('SURGEON_ACCESS_CODE');
    expect(message).toContain('SYNC_CODE');
  });

  it('rejects a SYNC_CODE shorter than 12 characters', () => {
    expect(() => loadEnv(validSource({ SYNC_CODE: 'short-code' }))).toThrow(
      /Invalid configuration: .*SYNC_CODE: must be at least 12 characters/,
    );
  });

  it('rejects a SURGEON_ACCESS_CODE shorter than 12 characters', () => {
    expect(() => loadEnv(validSource({ SURGEON_ACCESS_CODE: 'too-short' }))).toThrow(
      /SURGEON_ACCESS_CODE: must be at least 12 characters/,
    );
  });

  it('rejects identical SURGEON_ACCESS_CODE and SYNC_CODE and names both', () => {
    let message = '';
    try {
      loadEnv(validSource({ SURGEON_ACCESS_CODE: SYNC_CODE }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('SURGEON_ACCESS_CODE');
    expect(message).toContain('SYNC_CODE');
    expect(message).toMatch(/must differ/);
  });

  it('parses CORS_ORIGINS as a trimmed list and drops empty entries', () => {
    const env = loadEnv(validSource({ CORS_ORIGINS: ' https://a.test , ,https://b.test ' }));
    expect(env.corsOrigins).toEqual(['https://a.test', 'https://b.test']);
  });

  it('defaults CORS_ORIGINS to the team Pages origin', () => {
    const env = loadEnv(validSource());
    expect(env.corsOrigins).toEqual([DEFAULT_CORS]);
  });

  it('rejects a CORS_ORIGINS value that is only separators', () => {
    expect(() => loadEnv(validSource({ CORS_ORIGINS: ' , ' }))).toThrow(/CORS_ORIGINS/);
  });

  it('defaults PORT to 3000', () => {
    const env = loadEnv(validSource());
    expect(env.port).toBe(3000);
  });

  it('does not include secret values in the error message', () => {
    const secret = 'leaked-secret-value-xyz';
    let message = '';
    try {
      loadEnv(validSource({ DATABASE_URL: 'not-a-url', SYNC_CODE: secret, SURGEON_ACCESS_CODE: secret }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).not.toContain(secret);
  });
});
