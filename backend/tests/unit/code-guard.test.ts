import type { ExecutionContext } from '@nestjs/common';
import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { AttemptLimiter } from '../../src/adapters/http/attempt-limiter';
import {
  clientKey,
  codesMatch,
  SurgeonCodeGuard,
  SyncCodeGuard,
} from '../../src/adapters/http/code.guard';
import { FAILED_ATTEMPTS_WINDOW_MS, MAX_FAILED_ATTEMPTS } from '../../src/config/constants';
import type { Env } from '../../src/config/env';

const SYNC_CODE = 'sync-code-4567890';
const ACCESS_CODE = 'surgeon-code-123';
const WRONG_CODE = 'wrong-code-000000';
const SOCKET_ADDRESS = '10.0.0.7';
const CLOUDFLARE_ADDRESS = '203.0.113.9';
const ONE_MS = 1;
const START_TIME = 1_000_000;

const ENV_FIXTURE: Env = {
  databaseUrl: 'postgres://user:pass@localhost:5432/basevital',
  port: 3000,
  surgeonAccessCode: ACCESS_CODE,
  syncCode: SYNC_CODE,
  corsOrigins: [],
};

function fakeRequest(headers: Record<string, string | string[]> = {}, address = SOCKET_ADDRESS) {
  return { headers, socket: { remoteAddress: address } } as unknown as Request;
}

function fakeContext(req: Request): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function errorOf(fn: () => unknown): HttpException {
  try {
    fn();
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('expected the guard to throw');
}

function fakeClock(limiter: AttemptLimiter, start = START_TIME) {
  let current = start;
  limiter.now = () => current;
  return {
    advance(ms: number) {
      current += ms;
    },
  };
}

describe('codesMatch', () => {
  it('matches an identical code', () => {
    expect(codesMatch(SYNC_CODE, SYNC_CODE)).toBe(true);
  });

  it('rejects a different code of the same length', () => {
    expect(codesMatch(WRONG_CODE, SYNC_CODE)).toBe(false);
  });

  it('rejects a missing code', () => {
    expect(codesMatch(undefined, SYNC_CODE)).toBe(false);
  });

  it('rejects a code of a different length', () => {
    expect(codesMatch(SYNC_CODE.slice(ONE_MS), SYNC_CODE)).toBe(false);
    expect(codesMatch(`${SYNC_CODE}x`, SYNC_CODE)).toBe(false);
  });
});

describe('AttemptLimiter', () => {
  it('does not block after MAX_FAILED_ATTEMPTS failures', () => {
    const limiter = new AttemptLimiter();
    fakeClock(limiter);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      limiter.recordFailure('a');
    }
    expect(limiter.isBlocked('a')).toBe(false);
  });

  it('blocks once the 11th failure is recorded', () => {
    const limiter = new AttemptLimiter();
    fakeClock(limiter);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS + 1; i++) {
      limiter.recordFailure('a');
    }
    expect(limiter.isBlocked('a')).toBe(true);
  });

  it('unblocks once the failures leave the window', () => {
    const limiter = new AttemptLimiter();
    const clock = fakeClock(limiter);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS + 1; i++) {
      limiter.recordFailure('a');
    }
    clock.advance(FAILED_ATTEMPTS_WINDOW_MS - ONE_MS);
    expect(limiter.isBlocked('a')).toBe(true);
    clock.advance(ONE_MS);
    expect(limiter.isBlocked('a')).toBe(false);
  });

  it('counts keys independently', () => {
    const limiter = new AttemptLimiter();
    fakeClock(limiter);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS + 1; i++) {
      limiter.recordFailure('a');
    }
    expect(limiter.isBlocked('a')).toBe(true);
    expect(limiter.isBlocked('b')).toBe(false);
  });
});

describe('clientKey', () => {
  it('prefers the cf-connecting-ip header', () => {
    expect(clientKey(fakeRequest({ 'cf-connecting-ip': CLOUDFLARE_ADDRESS }))).toBe(
      CLOUDFLARE_ADDRESS,
    );
  });

  it('uses the first value when the header repeats', () => {
    expect(clientKey(fakeRequest({ 'cf-connecting-ip': [CLOUDFLARE_ADDRESS, SOCKET_ADDRESS] }))).toBe(
      CLOUDFLARE_ADDRESS,
    );
  });

  it('falls back to the socket address', () => {
    expect(clientKey(fakeRequest({}))).toBe(SOCKET_ADDRESS);
  });

  it('returns unknown when there is no address at all', () => {
    const req = { headers: {}, socket: { remoteAddress: undefined } } as unknown as Request;
    expect(clientKey(req)).toBe('unknown');
  });
});

describe('SyncCodeGuard', () => {
  it('allows a correct X-Sync-Code', () => {
    const guard = new SyncCodeGuard(ENV_FIXTURE, new AttemptLimiter());
    const ctx = fakeContext(fakeRequest({ 'x-sync-code': SYNC_CODE }));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('answers a wrong code with 401 invalid_code', () => {
    const guard = new SyncCodeGuard(ENV_FIXTURE, new AttemptLimiter());
    const ctx = fakeContext(fakeRequest({ 'x-sync-code': WRONG_CODE }));
    const error = errorOf(() => guard.canActivate(ctx));
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse()).toEqual({ error: 'invalid_code' });
  });

  it('answers a missing code with 401 invalid_code', () => {
    const guard = new SyncCodeGuard(ENV_FIXTURE, new AttemptLimiter());
    const error = errorOf(() => guard.canActivate(fakeContext(fakeRequest({}))));
    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse()).toEqual({ error: 'invalid_code' });
  });

  it('keys failures by cf-connecting-ip', () => {
    const limiter = new AttemptLimiter();
    const guard = new SyncCodeGuard(ENV_FIXTURE, limiter);
    const ctx = fakeContext(
      fakeRequest({ 'x-sync-code': WRONG_CODE, 'cf-connecting-ip': CLOUDFLARE_ADDRESS }),
    );
    errorOf(() => guard.canActivate(ctx));
    expect(limiter.isBlocked(CLOUDFLARE_ADDRESS)).toBe(false);
    const recorded = limiter as unknown as { failures: Map<string, number[]> };
    expect([...recorded.failures.keys()]).toEqual([CLOUDFLARE_ADDRESS]);
  });

  it('answers 429 too_many_attempts on the 11th wrong code', () => {
    const limiter = new AttemptLimiter();
    fakeClock(limiter);
    const guard = new SyncCodeGuard(ENV_FIXTURE, limiter);
    const ctx = fakeContext(fakeRequest({ 'x-sync-code': WRONG_CODE }));
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      expect(errorOf(() => guard.canActivate(ctx)).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
    const error = errorOf(() => guard.canActivate(ctx));
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(error.getResponse()).toEqual({ error: 'too_many_attempts' });
  });

  it('answers 429 even with the correct code while blocked', () => {
    const limiter = new AttemptLimiter();
    fakeClock(limiter);
    const guard = new SyncCodeGuard(ENV_FIXTURE, limiter);
    const wrong = fakeContext(fakeRequest({ 'x-sync-code': WRONG_CODE }));
    for (let i = 0; i < MAX_FAILED_ATTEMPTS + 1; i++) {
      errorOf(() => guard.canActivate(wrong));
    }
    const correct = fakeContext(fakeRequest({ 'x-sync-code': SYNC_CODE }));
    const error = errorOf(() => guard.canActivate(correct));
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(error.getResponse()).toEqual({ error: 'too_many_attempts' });
  });
});

describe('SurgeonCodeGuard', () => {
  it('allows a correct X-Access-Code', () => {
    const guard = new SurgeonCodeGuard(ENV_FIXTURE, new AttemptLimiter());
    const ctx = fakeContext(fakeRequest({ 'x-access-code': ACCESS_CODE }));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('does not accept the sync code in place of the access code', () => {
    const guard = new SurgeonCodeGuard(ENV_FIXTURE, new AttemptLimiter());
    const ctx = fakeContext(fakeRequest({ 'x-access-code': SYNC_CODE }));
    const error = errorOf(() => guard.canActivate(ctx));
    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse()).toEqual({ error: 'invalid_code' });
  });

  it('shares the attempt limiter with the sync guard', () => {
    const limiter = new AttemptLimiter();
    fakeClock(limiter);
    const sync = new SyncCodeGuard(ENV_FIXTURE, limiter);
    const surgeon = new SurgeonCodeGuard(ENV_FIXTURE, limiter);
    const badSync = fakeContext(fakeRequest({ 'x-sync-code': WRONG_CODE }));
    for (let i = 0; i < MAX_FAILED_ATTEMPTS + 1; i++) {
      errorOf(() => sync.canActivate(badSync));
    }
    const ctx = fakeContext(fakeRequest({ 'x-access-code': ACCESS_CODE }));
    expect(errorOf(() => surgeon.canActivate(ctx)).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });
});
