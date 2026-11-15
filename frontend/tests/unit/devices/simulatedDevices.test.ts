import { describe, it, expect } from 'vitest';
import type { DemoScenario } from '@base-vital/contracts';
import { Observation } from '@base-vital/contracts';
import { DEMO_SCENARIOS } from '../../../src/config/demoScenarios';
import { SimulatedDevices } from '../../../src/adapters/simulated-devices/SimulatedDevices';

const FIXED_AT = new Date('2026-11-15T08:00:00.000Z');
const clock = () => FIXED_AT;

/** Clone a demo scenario and override some of its device values. */
function withDevices(
  base: DemoScenario,
  devices: Partial<DemoScenario['devices']>,
): DemoScenario {
  return { ...base, devices: { ...base.devices, ...devices } };
}

describe('SimulatedDevices', () => {
  it('returns scenario values as device observations with the correct flags', async () => {
    const devices = new SimulatedDevices(DEMO_SCENARIOS.normal, { clock });

    const hr = await devices.read('resting_heart_rate');
    const bp = await devices.read('blood_pressure');
    const temp = await devices.read('body_temperature');
    const spo2 = await devices.read('oxygen_saturation');

    expect(hr).toEqual({
      indicator: 'resting_heart_rate',
      value: 64,
      source: 'device',
      confirmed: true,
      simulated: true,
      at: FIXED_AT.toISOString(),
    });
    expect(bp?.value).toEqual({ systolic: 112, diastolic: 72 });
    expect(bp?.indicator).toBe('blood_pressure');
    expect(temp?.value).toBe(36.6);
    expect(spo2?.value).toBe(98);

    for (const obs of [hr, bp, temp, spo2]) {
      expect(obs).not.toBeNull();
      expect(Observation.safeParse(obs).success).toBe(true);
      expect(obs!.source).toBe('device');
      expect(obs!.confirmed).toBe(true);
      expect(obs!.simulated).toBe(true);
      expect(obs!.at).toBe(FIXED_AT.toISOString());
    }
  });

  it('returns null for blood pressure and 97 for SpO2 in the missing_sensor scenario', async () => {
    const devices = new SimulatedDevices(DEMO_SCENARIOS.missing_sensor, { clock });

    expect(await devices.read('blood_pressure')).toBeNull();
    expect((await devices.read('oxygen_saturation'))?.value).toBe(97);
  });

  it('returns null for implausible values', async () => {
    const hrLow = new SimulatedDevices(
      withDevices(DEMO_SCENARIOS.normal, { resting_heart_rate: 25 }),
      { clock },
    );
    const spo2Low = new SimulatedDevices(
      withDevices(DEMO_SCENARIOS.normal, { oxygen_saturation: 65 }),
      { clock },
    );
    const tempHigh = new SimulatedDevices(
      withDevices(DEMO_SCENARIOS.normal, { body_temperature: 44 }),
      { clock },
    );
    const sysHigh = new SimulatedDevices(
      withDevices(DEMO_SCENARIOS.normal, { blood_pressure: { systolic: 260, diastolic: 80 } }),
      { clock },
    );
    const diaLow = new SimulatedDevices(
      withDevices(DEMO_SCENARIOS.normal, { blood_pressure: { systolic: 120, diastolic: 35 } }),
      { clock },
    );

    expect(await hrLow.read('resting_heart_rate')).toBeNull();
    expect(await spo2Low.read('oxygen_saturation')).toBeNull();
    expect(await tempHigh.read('body_temperature')).toBeNull();
    expect(await sysHigh.read('blood_pressure')).toBeNull();
    expect(await diaLow.read('blood_pressure')).toBeNull();
  });

  it('returns the scenario pulse for every scenario', async () => {
    for (const id of ['normal', 'ca4', 'missing_sensor', 'low_temp', 'voice_not_understood'] as const) {
      const scenario = DEMO_SCENARIOS[id];
      const devices = new SimulatedDevices(scenario, { clock });
      expect((await devices.read('resting_heart_rate'))?.value).toBe(
        scenario.devices.resting_heart_rate,
      );
    }
  });
});
