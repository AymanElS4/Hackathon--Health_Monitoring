import { describe, expect, it } from 'vitest';
import { SyncCheck } from '../../src/domain/sync-check';
import { OBSERVED_AT, validSyncCheck } from '../fixtures/sync-check.builder';

const STORED_LIMIT = 10_000;

type Fixture = ReturnType<typeof validSyncCheck>;

/** Clones the valid fixture so each test can mutate its own copy. */
function clone(): Fixture {
  return structuredClone(validSyncCheck());
}

describe('SyncCheck envelope', () => {
  it('accepts a valid daily check', () => {
    const result = SyncCheck.safeParse(validSyncCheck());
    expect(result.success).toBe(true);
  });

  it('rejects an unconfirmed voice observation', () => {
    const payload = clone();
    payload.check.observations[0] = { ...payload.check.observations[0], confirmed: false } as never;
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects ok with an action key', () => {
    const payload = clone();
    payload.check.actionKey = 'action.red';
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects attention without an action key', () => {
    const payload = clone();
    payload.check.verdict = 'attention';
    payload.check.actionKey = '';
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects a repeated indicator and points at the repeated observation', () => {
    const payload = clone();
    payload.check.observations.push({
      indicator: 'mood',
      source: 'voice',
      confirmed: true,
      simulated: false,
      at: OBSERVED_AT,
      value: 2,
    } as never);
    const result = SyncCheck.safeParse(payload);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ['check', 'observations', 6, 'indicator'] }),
    );
  });

  it('rejects kind other than daily', () => {
    const payload = { ...clone(), kind: 'exit' };
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects a device source other than voice or device', () => {
    const payload = clone();
    payload.check.observations[2] = {
      ...payload.check.observations[2],
      source: 'button',
    } as never;
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects an unknown top-level field', () => {
    const payload = { ...clone(), extra: 'not in the contract' };
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects a malformed crewId', () => {
    const payload = { ...clone(), crewId: 'crew-ABC123' };
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects a missionDay below 1', () => {
    const payload = { ...clone(), missionDay: 0 };
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects a numeric value at or above the stored limit', () => {
    const payload = clone();
    payload.check.observations[2] = {
      ...payload.check.observations[2],
      value: STORED_LIMIT,
    } as never;
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects a negative numeric value at or beyond the stored limit', () => {
    const payload = clone();
    payload.check.observations[4] = {
      ...payload.check.observations[4],
      value: -STORED_LIMIT,
    } as never;
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects a blood pressure component at or above the stored limit', () => {
    const payload = clone();
    payload.check.observations[3] = {
      ...payload.check.observations[3],
      value: { systolic: STORED_LIMIT, diastolic: 76 },
    } as never;
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('accepts a numeric value just below the stored limit', () => {
    const payload = clone();
    payload.check.observations[2] = {
      ...payload.check.observations[2],
      value: 9999.99,
    } as never;
    expect(SyncCheck.safeParse(payload).success).toBe(true);
  });

  it('rejects a numeric value of 9999.995, which would round up to 10000.00 in numeric(6,2)', () => {
    const payload = clone();
    payload.check.observations[2] = {
      ...payload.check.observations[2],
      value: 9999.995,
    } as never;
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('rejects a blood pressure systolic that is not whole mmHg, pointing at the observation value', () => {
    const payload = clone();
    payload.check.observations[3] = {
      ...payload.check.observations[3],
      value: { systolic: 120.5, diastolic: 76 },
    } as never;
    const result = SyncCheck.safeParse(payload);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ['check', 'observations', 3, 'value'],
        message: 'blood pressure must be whole mmHg',
      }),
    );
  });

  it('rejects a blood pressure diastolic that is not whole mmHg', () => {
    const payload = clone();
    payload.check.observations[3] = {
      ...payload.check.observations[3],
      value: { systolic: 120, diastolic: 76.4 },
    } as never;
    expect(SyncCheck.safeParse(payload).success).toBe(false);
  });

  it('accepts whole-mmHg blood pressure', () => {
    const payload = clone();
    payload.check.observations[3] = {
      ...payload.check.observations[3],
      value: { systolic: 120, diastolic: 76 },
    } as never;
    expect(SyncCheck.safeParse(payload).success).toBe(true);
  });

  it('strips an unknown field inside check instead of rejecting it', () => {
    const payload = clone();
    const withExtra = { ...payload, check: { ...payload.check, unexpected: 'dropped' } };
    const result = SyncCheck.safeParse(withExtra);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect('unexpected' in result.data.check).toBe(false);
  });
});
