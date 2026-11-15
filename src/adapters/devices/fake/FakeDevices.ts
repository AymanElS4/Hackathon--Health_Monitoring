import { Observation } from '../../../contracts';
import type { DevicePort } from '../../../application/ports';

// Fake device adapter for unit tests only. Returns fixed values passed to the
// constructor. It applies no plausibility checks: plausibility belongs to the
// simulated/real device adapters (CL2), and tests may need out-of-range values.

type Indicator = Parameters<DevicePort['read']>[0];

export type FakeDeviceValue = number | { systolic: number; diastolic: number } | null;

export type FakeDeviceValues = Partial<Record<Indicator, FakeDeviceValue>>;

export class FakeDevices implements DevicePort {
  private readonly values: FakeDeviceValues;
  private readonly at: string | undefined;

  /**
   * @param values Fixed value per indicator; `null` or a missing key means "no value".
   * @param at Optional fixed ISO date-time for every observation. When omitted, the
   *   current time is used at read time.
   */
  constructor(values: FakeDeviceValues, at?: string) {
    this.values = { ...values };
    this.at = at;
  }

  async read(indicator: Indicator): Promise<Observation | null> {
    const value = this.values[indicator];
    if (value === null || value === undefined) {
      return null;
    }
    return Observation.parse({
      indicator,
      value,
      source: 'device',
      confirmed: true,
      simulated: true,
      at: this.at ?? new Date().toISOString(),
    });
  }
}
