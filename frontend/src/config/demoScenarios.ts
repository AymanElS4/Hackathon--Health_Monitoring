import { DemoScenario, DemoScenarioId } from '@base-vital/contracts';

// Deterministic demo scenarios (FR-013, research R14, docs/base-vital-home-data-mapping.md §4).
// Device values are read by the simulated adapters; `priorNights` are the two nights before
// today, in hours, listed as [yesterday, the day before].
//
// Today's resting pulse is always the scenario value (`resting_heart_rate`). The WESAD
// series, when present, only seeds the history (see `pulseSeriesFor` in
// `frontend/src/application/use-cases/pulseSeries.ts`).

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenario> = {
  normal: {
    id: 'normal',
    devices: {
      resting_heart_rate: 64,
      blood_pressure: { systolic: 112, diastolic: 72 },
      body_temperature: 36.6,
      oxygen_saturation: 98,
    },
    priorNights: [7.2, 7.8],
    voice: 'real',
  },
  ca4: {
    id: 'ca4',
    devices: {
      resting_heart_rate: 72,
      blood_pressure: { systolic: 118, diastolic: 76 },
      body_temperature: 36.8,
      oxygen_saturation: 98,
    },
    priorNights: [7.1, 7.4],
    voice: 'real',
  },
  missing_sensor: {
    id: 'missing_sensor',
    devices: {
      resting_heart_rate: 66,
      // The blood pressure sensor sends nothing in this scenario.
      blood_pressure: null,
      body_temperature: 36.7,
      oxygen_saturation: 97,
    },
    priorNights: [7.0, 7.6],
    voice: 'real',
  },
  low_temp: {
    id: 'low_temp',
    devices: {
      resting_heart_rate: 66,
      blood_pressure: { systolic: 114, diastolic: 74 },
      body_temperature: 35.6,
      oxygen_saturation: 97,
    },
    priorNights: [7.1, 7.5],
    voice: 'real',
  },
  voice_not_understood: {
    id: 'voice_not_understood',
    devices: {
      resting_heart_rate: 64,
      blood_pressure: { systolic: 112, diastolic: 72 },
      body_temperature: 36.6,
      oxygen_saturation: 98,
    },
    priorNights: [7.2, 7.8],
    voice: 'never_understands',
  },
};

/** Scenario active on first run (selector on Home, persisted per device). */
export const DEFAULT_SCENARIO_ID: DemoScenarioId = 'normal';
