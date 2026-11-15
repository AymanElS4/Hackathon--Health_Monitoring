import { DemoScenario, DemoScenarioId } from '@base-vital/contracts';

// Deterministic demo scenarios (FR-013, research R14). Device values are read by the
// simulated adapters; `priorNights` are the two nights before today, in hours.

/** Devices and history shared by every scenario except where noted. */
const NORMAL_DEVICES = {
  // nominal value; the simulated oximeter replays WESAD minutes in 60–100 bpm when
  // data/wesad-hr.json is available (T022)
  resting_heart_rate: 68,
  blood_pressure: { systolic: 112, diastolic: 72 },
  body_temperature: 36.7,
  oxygen_saturation: 98,
} as const;

const NORMAL_NIGHTS = [7.5, 7.0];

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenario> = {
  normal: {
    id: 'normal',
    devices: { ...NORMAL_DEVICES, blood_pressure: { ...NORMAL_DEVICES.blood_pressure } },
    priorNights: [...NORMAL_NIGHTS],
    voice: 'real',
  },
  ca4: {
    id: 'ca4',
    devices: { ...NORMAL_DEVICES, blood_pressure: { ...NORMAL_DEVICES.blood_pressure } },
    priorNights: [...NORMAL_NIGHTS],
    voice: 'real',
  },
  missing_sensor: {
    id: 'missing_sensor',
    devices: {
      ...NORMAL_DEVICES,
      blood_pressure: { ...NORMAL_DEVICES.blood_pressure },
      oxygen_saturation: null,
    },
    priorNights: [...NORMAL_NIGHTS],
    voice: 'real',
  },
  low_temp: {
    id: 'low_temp',
    devices: {
      ...NORMAL_DEVICES,
      blood_pressure: { ...NORMAL_DEVICES.blood_pressure },
      body_temperature: 35.6,
    },
    priorNights: [...NORMAL_NIGHTS],
    voice: 'real',
  },
  voice_not_understood: {
    id: 'voice_not_understood',
    devices: { ...NORMAL_DEVICES, blood_pressure: { ...NORMAL_DEVICES.blood_pressure } },
    priorNights: [...NORMAL_NIGHTS],
    voice: 'never_understands',
  },
};

/** Scenario active on first run (selector on Home, persisted per device). */
export const DEFAULT_SCENARIO_ID: DemoScenarioId = 'normal';
