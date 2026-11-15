import type { Observation } from '@base-vital/contracts';

/** Device port. Reads one vital; null when the device sends nothing (CL2). */
export interface DevicePort {
  read(
    indicator: 'resting_heart_rate' | 'blood_pressure' | 'body_temperature' | 'oxygen_saturation',
  ): Promise<Observation | null>;
}
