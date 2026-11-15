import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';

const DATABASE_UNAVAILABLE_ERROR = 'database_unavailable';
const INVALID_CHECK_ERROR = 'invalid_check';
/** SQLSTATE class 22 (data exception) and 23 (integrity constraint violation): the data is at fault. */
const PERMANENT_SQLSTATE_PREFIXES = ['22', '23'];

/**
 * Runs a repository call and maps failures. Data rejected by the database (SQLSTATE class 22/23)
 * becomes a permanent `400 invalid_check` so the tablet does not retry; anything else becomes
 * `503 database_unavailable`. Only the SQLSTATE is logged: driver messages can echo input values.
 */
export async function withDatabase<T>(fn: () => Promise<T>, logger: Logger): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    logger.error(`Check repository error (code ${typeof code === 'string' ? code : 'unknown'})`);
    if (typeof code === 'string' && PERMANENT_SQLSTATE_PREFIXES.some((prefix) => code.startsWith(prefix))) {
      throw new BadRequestException({ error: INVALID_CHECK_ERROR, issues: [] });
    }
    throw new ServiceUnavailableException({ error: DATABASE_UNAVAILABLE_ERROR });
  }
}
