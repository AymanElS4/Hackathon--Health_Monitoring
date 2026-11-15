/**
 * One measuring stage (T052): reads the device indicators of a `readDevices` effect and, when the
 * pulse is among them, whether it is outside "tu normal" (CL4). Returns the `devicesRead` event the
 * runner dispatches. Kept apart from the runner so that its file stays under the line limit.
 */
import type { CheckinEvent } from '../../domain/checkin/types';
import type { CheckRepositoryPort, ClockPort, DevicePort } from '../ports';
import { pulseOutsideNormalOf } from './pulseOutsideNormal';
import { readDeviceObservations } from './readDeviceObservations';

export interface ReadDevicesDeps {
  devices: DevicePort;
  repository: CheckRepositoryPort;
  clock: ClockPort;
}

export async function readDevicesStep(
  deps: ReadDevicesDeps,
  indicators: readonly string[],
): Promise<CheckinEvent> {
  const observations = await readDeviceObservations(deps.devices, indicators);
  const outside = indicators.includes('resting_heart_rate')
    ? await pulseOutsideNormalOf(deps.repository, deps.clock, observations)
    : undefined;
  return { type: 'devicesRead', observations, pulseOutsideNormal: outside };
}
