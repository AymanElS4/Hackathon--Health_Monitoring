import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { ENV, type Env } from '../../config/env';
import { AttemptLimiter } from './attempt-limiter';

// Shared-code guards for the tablet sync endpoint and the surgeon pages.
// Codes are compared as SHA-256 digests so both sides have equal length for timingSafeEqual.

const UNKNOWN_CLIENT = 'unknown';
const INVALID_CODE_ERROR = 'invalid_code';
const TOO_MANY_ATTEMPTS_ERROR = 'too_many_attempts';
const SYNC_CODE_HEADER = 'x-sync-code';
const ACCESS_CODE_HEADER = 'x-access-code';
const CLIENT_IP_HEADER = 'cf-connecting-ip';

/** Compares two codes in constant time. A missing code never matches. */
export function codesMatch(given: string | undefined, expected: string): boolean {
  if (given === undefined) {
    return false;
  }
  const givenDigest = createHash('sha256').update(given, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(givenDigest, expectedDigest);
}

/** Identifies the calling client: Cloudflare's connecting IP, else the socket address. */
export function clientKey(req: Request): string {
  const forwarded = req.headers[CLIENT_IP_HEADER];
  const fromHeader = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (fromHeader !== undefined && fromHeader.length > 0) {
    return fromHeader;
  }
  return req.socket.remoteAddress ?? UNKNOWN_CLIENT;
}

function headerValue(req: Request, name: string): string | undefined {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Shared guard logic. A blocked client gets 429 even with the right code. A wrong code is
 * recorded as a failure; the failure that crosses the limit is answered with 429 too.
 */
function enforceCode(
  context: ExecutionContext,
  header: string,
  expected: string,
  limiter: AttemptLimiter,
): true {
  const req = context.switchToHttp().getRequest<Request>();
  const key = clientKey(req);
  const tooMany = (): HttpException =>
    new HttpException({ error: TOO_MANY_ATTEMPTS_ERROR }, HttpStatus.TOO_MANY_REQUESTS);

  if (limiter.isBlocked(key)) {
    throw tooMany();
  }
  if (codesMatch(headerValue(req, header), expected)) {
    return true;
  }
  limiter.recordFailure(key);
  if (limiter.isBlocked(key)) {
    throw tooMany();
  }
  throw new UnauthorizedException({ error: INVALID_CODE_ERROR });
}

/** Protects `POST /api/v1/checks` with the tablet's shared sync code (`X-Sync-Code`). */
@Injectable()
export class SyncCodeGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly limiter: AttemptLimiter,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    return enforceCode(context, SYNC_CODE_HEADER, this.env.syncCode, this.limiter);
  }
}

/** Protects the surgeon endpoints with the surgeon access code (`X-Access-Code`). */
@Injectable()
export class SurgeonCodeGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly limiter: AttemptLimiter,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    return enforceCode(context, ACCESS_CODE_HEADER, this.env.surgeonAccessCode, this.limiter);
  }
}
