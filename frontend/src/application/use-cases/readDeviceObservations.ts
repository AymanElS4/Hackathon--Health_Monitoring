/**
 * Reads the device indicators of a `readDevices` effect (T052). Indicators outside the device
 * set are skipped; a device with no value contributes nothing.
 */
import type { Observation } from '@base-vital/contracts';
import type { DevicePort } from '../ports';

type DeviceIndicator = Parameters<DevicePort['read']>[0];

const DEVICE_INDICATORS: readonly string[] = [
  'resting_heart_rate',
  'blood_pressure',
  'body_temperature',
  'oxygen_saturation',
];

export async function readDeviceObservations(
  devices: DevicePort,
  indicators: readonly string[],
): Promise<Observation[]> {
  const observations: Observation[] = [];
  for (const indicator of indicators) {
    if (!DEVICE_INDICATORS.includes(indicator)) continue;
    const observation = await devices.read(indicator as DeviceIndicator);
    if (observation !== null) observations.push(observation);
  }
  return observations;
}
