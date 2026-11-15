import { Observation, DemoScenario } from '../../../contracts';
import type { DevicePort } from '../../../application/ports';

// Simulated device adapter (research R14, FR-013). Values come from the active demo
// scenario. The resting heart rate can be replayed from a pulse series (WESAD minutes),
// which is passed in by the composition root; the series is never imported here.
// Every scenario is treated as "as normal" (R14), so the replayed series is always
// filtered to the nominal 60–100 bpm band, whatever the scenario.

type Indicator = Parameters<DevicePort['read']>[0];

const NOMINAL_PULSE_MIN = 60;
const NOMINAL_PULSE_MAX = 100;

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
  /** Pulse series (bpm) replayed one value per read, cycling. */
  bpmSeries?: number[];
  /** Clock used for the `at` field of every observation. */
  clock?: () => Date;
}

export class SimulatedDevices implements DevicePort {
  private readonly scenario: DemoScenario;
  private readonly clock: () => Date;
  /** Pulse values eligible for replay; empty means "use the scenario value". */
  private readonly pulseReplay: readonly number[];
  private pulseCursor = 0;

  constructor(scenario: DemoScenario, opts: SimulatedDevicesOptions = {}) {
    this.scenario = scenario;
    this.clock = opts.clock ?? (() => new Date());
    const series = opts.bpmSeries ?? [];
    this.pulseReplay = series.filter((bpm) =>
      inRange(bpm, { min: NOMINAL_PULSE_MIN, max: NOMINAL_PULSE_MAX }),
    );
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
        const value = this.nextPulse();
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

  /** Next replayed pulse, or the scenario value when there is no usable series. */
  private nextPulse(): number | null {
    if (this.pulseReplay.length === 0) {
      return this.scenario.devices.resting_heart_rate;
    }
    const value = this.pulseReplay[this.pulseCursor];
    this.pulseCursor = (this.pulseCursor + 1) % this.pulseReplay.length;
    return value;
  }
}
