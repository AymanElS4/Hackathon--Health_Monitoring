import { Observation, DemoScenario } from '@base-vital/contracts';
import type { DevicePort } from '../../application/ports';

// Simulated device adapter (research R14, FR-013). Values come from the active demo
// scenario. Today's resting heart rate is always the scenario value. The WESAD pulse
// series is not read here; history seeding uses `pulseSeriesFor` from
// `frontend/src/application/use-cases/pulseSeries.ts` (T088).

type Indicator = Parameters<DevicePort['read']>[0];

/** Plausibility bounds (inclusive). Values outside them are sent as "no value" (CL2). */
const PLAUSIBLE = {
  heartRate: { min: 30, max: 220 },
  spo2: { min: 70, max: 100 },
  temperature: { min: 30, max: 43 },
  systolic: { min: 70, max: 250 },
  diastolic: { min: 40, max: 150 },
} as const;

function inRange(value: number, band: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= band.min && value <= band.max;
}

export interface SimulatedDevicesOptions {
  /** Clock used for the `at` field of every observation. */
  clock?: () => Date;
}

export class SimulatedDevices implements DevicePort {
  private readonly scenario: DemoScenario;
  private readonly clock: () => Date;

  constructor(scenario: DemoScenario, opts: SimulatedDevicesOptions = {}) {
    this.scenario = scenario;
    this.clock = opts.clock ?? (() => new Date());
  }

  async read(indicator: Indicator): Promise<Observation | null> {
    const value = this.valueFor(indicator);
    if (value === null) {
      return null;
    }
    return Observation.parse({
      indicator,
      value,
      source: 'device',
      confirmed: true,
      simulated: true,
      at: this.clock().toISOString(),
    });
  }

  private valueFor(indicator: Indicator): number | { systolic: number; diastolic: number } | null {
    const { devices } = this.scenario;
    switch (indicator) {
      case 'resting_heart_rate': {
        const value = devices.resting_heart_rate;
        return value !== null && inRange(value, PLAUSIBLE.heartRate) ? value : null;
      }
      case 'oxygen_saturation': {
        const value = devices.oxygen_saturation;
        return value !== null && inRange(value, PLAUSIBLE.spo2) ? value : null;
      }
      case 'body_temperature': {
        const value = devices.body_temperature;
        return value !== null && inRange(value, PLAUSIBLE.temperature) ? value : null;
      }
      case 'blood_pressure': {
        const bp = devices.blood_pressure;
        if (
          bp === null ||
          !inRange(bp.systolic, PLAUSIBLE.systolic) ||
          !inRange(bp.diastolic, PLAUSIBLE.diastolic)
        ) {
          return null;
        }
        return { systolic: bp.systolic, diastolic: bp.diastolic };
      }
    }
  }
}
