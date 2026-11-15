import { describe, expect, it } from 'vitest';
import { SyncCheck } from '../../src/domain/sync-check';
import { toStoredCheck } from '../../src/domain/to-stored-check';
import { CHECK_ID, CLIENT_CHECK_ID, CREW_ID, MISSION_DAY, validSyncCheck } from '../fixtures/sync-check.builder';

const ACTION_KEY = 'action.red';
const ALERT_DAY_ONE_CHECK_ID = '2026-11-15T23:59:00.000Z';

/** Parses the valid fixture so every test works on the typed envelope. */
function parsed(): SyncCheck {
  const result = SyncCheck.safeParse(validSyncCheck());
  if (!result.success) throw new Error('fixture must be a valid SyncCheck');
  return result.data;
}

/** Returns the parsed fixture with the check-level fields overridden. */
function withCheck(overrides: Partial<SyncCheck['check']>): SyncCheck {
  const envelope = parsed();
  return { ...envelope, check: { ...envelope.check, ...overrides } };
}

describe('toStoredCheck envelope mapping', () => {
  it('copies the envelope identity and check fields', () => {
    const { check } = toStoredCheck(parsed());
    expect(check.clientCheckId).toBe(CLIENT_CHECK_ID);
    expect(check.crewId).toBe(CREW_ID);
    expect(check.kind).toBe('daily');
    expect(check.missionDay).toBe(MISSION_DAY);
    expect(check.simulated).toBe(false);
    expect(check.symptoms).toEqual(['none']);
    expect(check.verdict).toBe('ok');
    expect(check.readings).toEqual(parsed().check.readings);
  });

  it('uses the check id as completedAt', () => {
    const { check } = toStoredCheck(parsed());
    expect(check.completedAt).toBe(CHECK_ID);
  });

  it('maps an empty actionKey to null', () => {
    const { check } = toStoredCheck(parsed());
    expect(check.actionKey).toBeNull();
  });

  it('keeps a non-empty actionKey', () => {
    const input = withCheck({ verdict: 'attention', actionKey: ACTION_KEY });
    const { check } = toStoredCheck(input);
    expect(check.actionKey).toBe(ACTION_KEY);
  });
});

describe('toStoredCheck alert urgency (R9)', () => {
  it('opens no alert for ok', () => {
    expect(toStoredCheck(parsed()).alert).toBeNull();
  });

  it('opens a soon alert for attention', () => {
    const { alert } = toStoredCheck(withCheck({ verdict: 'attention', actionKey: ACTION_KEY }));
    expect(alert).toEqual({ urgency: 'soon' });
  });

  it('opens a now alert for alert', () => {
    const { alert } = toStoredCheck(withCheck({ verdict: 'alert', actionKey: ACTION_KEY }));
    expect(alert).toEqual({ urgency: 'now' });
  });
});

describe('toStoredCheck observation units', () => {
  it('assigns the unit of each indicator from INDICATOR_UNITS', () => {
    const { check } = toStoredCheck(parsed());
    const units = Object.fromEntries(check.observations.map((o) => [o.indicator, o.unit]));
    expect(units).toEqual({
      sleep_hours: 'h',
      mood: '1-5',
      resting_heart_rate: 'lpm',
      blood_pressure: 'mmHg',
      body_temperature: '°C',
      oxygen_saturation: '%',
    });
  });
});

describe('toStoredCheck observation values', () => {
  it('stores blood pressure in systolic and diastolic with numeric null', () => {
    const { check } = toStoredCheck(parsed());
    const bp = check.observations.find((o) => o.indicator === 'blood_pressure');
    expect(bp).toBeDefined();
    expect(bp?.systolic).toBe(118);
    expect(bp?.diastolic).toBe(76);
    expect(bp?.numeric).toBeNull();
  });

  it('stores every other indicator in numeric with systolic and diastolic null', () => {
    const { check } = toStoredCheck(parsed());
    const others = check.observations.filter((o) => o.indicator !== 'blood_pressure');
    expect(others).toHaveLength(5);
    for (const observation of others) {
      expect(observation.systolic).toBeNull();
      expect(observation.diastolic).toBeNull();
      expect(typeof observation.numeric).toBe('number');
    }
    const sleep = others.find((o) => o.indicator === 'sleep_hours');
    expect(sleep?.numeric).toBe(7);
    const mood = others.find((o) => o.indicator === 'mood');
    expect(mood?.numeric).toBe(4);
  });

  it('copies source, confirmed and simulated per observation', () => {
    const { check } = toStoredCheck(parsed());
    const voice = check.observations.find((o) => o.indicator === 'mood');
    expect(voice).toMatchObject({ source: 'voice', confirmed: true, simulated: false });
    const device = check.observations.find((o) => o.indicator === 'oxygen_saturation');
    expect(device).toMatchObject({ source: 'device', confirmed: true, simulated: true });
  });

  it('sets capturedAt to the observation at timestamp', () => {
    const envelope = parsed();
    envelope.check.observations[0] = { ...envelope.check.observations[0], at: '2026-11-15T07:30:00.000Z' } as never;
    const { check } = toStoredCheck(envelope);
    expect(check.observations[0]?.capturedAt).toBe('2026-11-15T07:30:00.000Z');
    expect(check.observations[1]?.capturedAt).toBe(CHECK_ID);
  });
});

describe('toStoredCheck missionStartDate', () => {
  it('derives the mission start from completedAt and missionDay (day 23 ⇒ 23 days earlier + 1)', () => {
    const { check } = toStoredCheck(parsed());
    expect(check.missionStartDate).toBe('2026-10-24');
  });

  it('gives the completion date itself for mission day 1', () => {
    const envelope = { ...parsed(), missionDay: 1 };
    expect(toStoredCheck(envelope).check.missionStartDate).toBe('2026-11-15');
  });

  it('uses the UTC calendar date of completedAt', () => {
    const envelope = withCheck({ id: ALERT_DAY_ONE_CHECK_ID });
    const { check } = toStoredCheck({ ...envelope, missionDay: 1 });
    expect(check.missionStartDate).toBe('2026-11-15');
  });
});
