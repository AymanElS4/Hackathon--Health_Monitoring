import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

const INVALID_CHECK_ERROR = 'invalid_check';

/**
 * True when the response body is one of our own `{ error: '<code>', ... }` bodies. Nest's default
 * exception body also has a string `error` (e.g. 'Bad Request') but carries a numeric `statusCode`,
 * so it is not ours and is mapped below.
 */
function isOwnErrorBody(response: unknown): boolean {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  const body = response as { error?: unknown; statusCode?: unknown };
  return typeof body.error === 'string' && typeof body.statusCode !== 'number';
}

/**
 * Maps any `BadRequestException` without our own error body (for example the body parser rejecting
 * malformed JSON, which carries Nest's default `{ statusCode, message, error }`) to
 * `400 { error: 'invalid_check', issues: [] }`. Our own error bodies pass through unchanged.
 */
@Catch(BadRequestException)
export class BodyParseFilter implements ExceptionFilter<BadRequestException> {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = isOwnErrorBody(exception.getResponse())
      ? exception.getResponse()
      : { error: INVALID_CHECK_ERROR, issues: [] };
    response.status(HttpStatus.BAD_REQUEST).json(body);
  }
}
