import { describe, it, expect } from 'vitest';
import { Observation } from '@base-vital/contracts';
import { FakeDevices } from '../../../src/adapters/fakes/FakeDevices';

const FIXED_AT = '2026-11-15T08:00:00.000Z';

describe('FakeDevices', () => {
  it('returns fixed values as valid device observations with the correct flags', async () => {
    const devices = new FakeDevices(
      {
        resting_heart_rate: 66,
        blood_pressure: { systolic: 118, diastolic: 76 },
        body_temperature: 36.5,
        oxygen_saturation: 97,
      },
      FIXED_AT,
    );

    const hr = await devices.read('resting_heart_rate');
    const bp = await devices.read('blood_pressure');
    const temp = await devices.read('body_temperature');
    const spo2 = await devices.read('oxygen_saturation');

    expect(hr).toEqual({
      indicator: 'resting_heart_rate',
      value: 66,
      source: 'device',
      confirmed: true,
      simulated: true,
      at: FIXED_AT,
    });
    expect(bp?.indicator).toBe('blood_pressure');
    expect(bp?.value).toEqual({ systolic: 118, diastolic: 76 });
    expect(temp?.value).toBe(36.5);
    expect(spo2?.value).toBe(97);

    for (const obs of [hr, bp, temp, spo2]) {
      expect(obs).not.toBeNull();
      expect(Observation.safeParse(obs).success).toBe(true);
      expect(obs!.source).toBe('device');
      expect(obs!.confirmed).toBe(true);
      expect(obs!.simulated).toBe(true);
      expect(obs!.at).toBe(FIXED_AT);
    }
  });

  it('returns null for null, undefined, or missing values', async () => {
    const devices = new FakeDevices({
      resting_heart_rate: null,
      blood_pressure: undefined,
    }, FIXED_AT);

    expect(await devices.read('resting_heart_rate')).toBeNull();
    expect(await devices.read('blood_pressure')).toBeNull();
    expect(await devices.read('body_temperature')).toBeNull();
    expect(await devices.read('oxygen_saturation')).toBeNull();
  });

  it('does not apply plausibility checks to the values it is given', async () => {
    const devices = new FakeDevices({ oxygen_saturation: 40, body_temperature: 50 }, FIXED_AT);

    expect((await devices.read('oxygen_saturation'))?.value).toBe(40);
    expect((await devices.read('body_temperature'))?.value).toBe(50);
  });
});
