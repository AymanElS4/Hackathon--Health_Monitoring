import 'reflect-metadata';
import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { withDatabase } from '../../src/adapters/http/database-errors';

const SECRET_VALUE = 'secret-input-value-42';

/** Builds a driver-like error whose message echoes an input value, as pg does. */
function driverError(code: string | undefined): Error & { code?: string } {
  const error = new Error(`invalid input syntax for ${SECRET_VALUE}`) as Error & { code?: string };
  if (code !== undefined) {
    error.code = code;
  }
  return error;
}

/** Runs `withDatabase` over a failing call and returns the thrown error plus the logger spy. */
async function run(error: unknown) {
  const logger = new Logger('test');
  const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  const thrown = await withDatabase(() => Promise.reject(error), logger).catch((e: unknown) => e);
  return { thrown, spy };
}

describe('withDatabase', () => {
  it('maps SQLSTATE 22P02 (invalid text representation) to 400 invalid_check', async () => {
    const { thrown } = await run(driverError('22P02'));

    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getResponse()).toEqual({ error: 'invalid_check', issues: [] });
  });

  it('maps SQLSTATE 23505 (unique violation) to 400 invalid_check', async () => {
    const { thrown } = await run(driverError('23505'));

    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getResponse()).toEqual({ error: 'invalid_check', issues: [] });
  });

  it('maps SQLSTATE 08006 (connection failure) to 503 database_unavailable', async () => {
    const { thrown } = await run(driverError('08006'));

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as ServiceUnavailableException).getResponse()).toEqual({ error: 'database_unavailable' });
  });

  it('maps a plain Error without SQLSTATE to 503 database_unavailable', async () => {
    const { thrown } = await run(new Error('connection refused'));

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as ServiceUnavailableException).getResponse()).toEqual({ error: 'database_unavailable' });
  });

  it('logs only the SQLSTATE and never the error message text', async () => {
    const { spy } = await run(driverError('22P02'));

    expect(spy).toHaveBeenCalledWith('Check repository error (code 22P02)');
    const logged = spy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).not.toContain(SECRET_VALUE);
  });

  it('logs "unknown" when the error carries no string code', async () => {
    const { spy } = await run(new Error(SECRET_VALUE));

    expect(spy).toHaveBeenCalledWith('Check repository error (code unknown)');
    expect(spy.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain(SECRET_VALUE);
  });
});
