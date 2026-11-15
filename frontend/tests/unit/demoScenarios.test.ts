import { describe, it, expect } from 'vitest';
import { DemoScenario, DemoScenarioId } from '@base-vital/contracts';
import { DEMO_SCENARIOS, DEFAULT_SCENARIO_ID } from '../../src/config/demoScenarios';

const ALL_IDS = ['normal', 'ca4', 'missing_sensor', 'low_temp', 'voice_not_understood'] as const;

/** Green bands from RN1 for the devices of the `normal` scenario. */
function expectAllGreen(scenario: DemoScenario): void {
  const { devices } = scenario;
  expect(devices.blood_pressure).not.toBeNull();
  const bp = devices.blood_pressure!;
  expect(bp.systolic < 120 && bp.diastolic < 80).toBe(true);
  expect(devices.oxygen_saturation).not.toBeNull();
  expect(devices.oxygen_saturation!).toBeGreaterThanOrEqual(95);
  expect(devices.body_temperature).not.toBeNull();
  expect(devices.body_temperature!).toBeGreaterThanOrEqual(36.1);
  expect(devices.body_temperature!).toBeLessThanOrEqual(37.2);
  expect(devices.resting_heart_rate).not.toBeNull();
  expect(devices.resting_heart_rate!).toBeGreaterThanOrEqual(60);
  expect(devices.resting_heart_rate!).toBeLessThanOrEqual(100);
}

describe('DEMO_SCENARIOS', () => {
  it('contains all five scenario ids, each valid against the DemoScenario schema', () => {
    expect(Object.keys(DEMO_SCENARIOS).sort()).toEqual([...ALL_IDS].sort());
    for (const id of ALL_IDS) {
      expect(DemoScenarioId.safeParse(id).success).toBe(true);
      const result = DemoScenario.safeParse(DEMO_SCENARIOS[id]);
      expect(result.success, `scenario ${id} must match DemoScenario`).toBe(true);
      expect(DEMO_SCENARIOS[id].id).toBe(id);
    }
  });

  it('defaults to the normal scenario', () => {
    expect(DEFAULT_SCENARIO_ID).toBe('normal');
  });

  it('normal and ca4 have all devices in green and both prior nights >= 7 h', () => {
    for (const id of ['normal', 'ca4'] as const) {
      expectAllGreen(DEMO_SCENARIOS[id]);
      for (const hours of DEMO_SCENARIOS[id].priorNights) {
        expect(hours).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('matches the fixed device values for each demo scenario', () => {
    expect(DEMO_SCENARIOS.normal.devices).toEqual({
      resting_heart_rate: 64,
      blood_pressure: { systolic: 112, diastolic: 72 },
      body_temperature: 36.6,
      oxygen_saturation: 98,
    });
    expect(DEMO_SCENARIOS.ca4.devices).toEqual({
      resting_heart_rate: 72,
      blood_pressure: { systolic: 118, diastolic: 76 },
      body_temperature: 36.8,
      oxygen_saturation: 98,
    });
    expect(DEMO_SCENARIOS.missing_sensor.devices).toEqual({
      resting_heart_rate: 66,
      blood_pressure: null,
      body_temperature: 36.7,
      oxygen_saturation: 97,
    });
    expect(DEMO_SCENARIOS.low_temp.devices).toEqual({
      resting_heart_rate: 66,
      blood_pressure: { systolic: 114, diastolic: 74 },
      body_temperature: 35.6,
      oxygen_saturation: 97,
    });
  });

  it('missing_sensor has no blood-pressure reading', () => {
    expect(DEMO_SCENARIOS.missing_sensor.devices.blood_pressure).toBeNull();
    expect(DEMO_SCENARIOS.missing_sensor.devices.oxygen_saturation).toBe(97);
  });

  it('low_temp has body temperature 35.6', () => {
    expect(DEMO_SCENARIOS.low_temp.devices.body_temperature).toBe(35.6);
  });

  it('voice_not_understood uses the never_understands voice mode', () => {
    expect(DEMO_SCENARIOS.voice_not_understood.voice).toBe('never_understands');
  });
});
