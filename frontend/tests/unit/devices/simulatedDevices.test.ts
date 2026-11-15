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

  it('returns null for blood pressure in the missing_sensor scenario', async () => {
    const devices = new SimulatedDevices(DEMO_SCENARIOS.missing_sensor, { clock });

    expect(await devices.read('blood_pressure')).toBeNull();
    expect(await devices.read('oxygen_saturation')).not.toBeNull();
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

  it('replays the pulse series in normal, skipping values outside 60–100', async () => {
    const devices = new SimulatedDevices(DEMO_SCENARIOS.normal, {
      bpmSeries: [50, 72, 110, 80, 101, 59, 90],
      clock,
    });

    const values: unknown[] = [];
    for (let i = 0; i < 5; i++) {
      values.push((await devices.read('resting_heart_rate'))?.value);
    }

    // In-range series is [72, 80, 90]; it cycles deterministically.
    expect(values).toEqual([72, 80, 90, 72, 80]);
  });

  it('filters the pulse series to 60–100 in every scenario, including missing_sensor', async () => {
    const devices = new SimulatedDevices(DEMO_SCENARIOS.missing_sensor, {
      bpmSeries: [45, 70, 130],
      clock,
    });

    for (let i = 0; i < 4; i++) {
      expect((await devices.read('resting_heart_rate'))?.value).toBe(70);
    }
  });

  it('falls back to the scenario value when no series is given', async () => {
    const noSeries = new SimulatedDevices(DEMO_SCENARIOS.normal, { clock });
    const emptySeries = new SimulatedDevices(DEMO_SCENARIOS.normal, { bpmSeries: [], clock });
    const allOutOfRange = new SimulatedDevices(DEMO_SCENARIOS.normal, {
      bpmSeries: [150, 40, 20],
      clock,
    });

    for (const devices of [noSeries, emptySeries, allOutOfRange]) {
      const obs = await devices.read('resting_heart_rate');
      expect(obs?.value).toBe(DEMO_SCENARIOS.normal.devices.resting_heart_rate);
      expect(obs?.simulated).toBe(true);
    }
  });
});
