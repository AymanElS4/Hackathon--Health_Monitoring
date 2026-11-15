/**
 * The CA4 check of Ana (SC-011): sleep 5 h (amber), blood pressure 118/76, pulse 72, temperature
 * 36,8 and oxygen 98 (green). Values are formatted with the app's own `formatReadingValue`, so the
 * tests read the same text the screen shows. Shared by the Home and check-in UI tests.
 */
import { CheckRecord, type Observation, type SensorKey, type SensorReading } from '@base-vital/contracts';
import { formatReadingValue } from '../../src/application/use-cases/formatReadingValue';

function greenReading(sensor: SensorKey, value: string): SensorReading {
  return { sensor, level: 'green', phase: 'confirmed', value, outsideNormal: false, teamCriterion: false, reason: null };
}

/** The CA4 check saved at `at` (ISO). Its observations carry the numbers the range bars place. */
export function ca4Check(at: string = new Date(2026, 10, 15, 9, 31).toISOString()): CheckRecord {
  const observations: Observation[] = [
    { indicator: 'sleep_hours', value: 5, source: 'voice', confirmed: true, simulated: false, at },
    { indicator: 'mood', value: 4, source: 'voice', confirmed: true, simulated: false, at },
    { indicator: 'blood_pressure', value: { systolic: 118, diastolic: 76 }, source: 'device', confirmed: true, simulated: true, at },
    { indicator: 'resting_heart_rate', value: 72, source: 'device', confirmed: true, simulated: true, at },
    { indicator: 'oxygen_saturation', value: 98, source: 'device', confirmed: true, simulated: true, at },
    { indicator: 'body_temperature', value: 36.8, source: 'device', confirmed: true, simulated: true, at },
  ];
  const sleep = observations[0];
  const readings: Record<SensorKey, SensorReading> = {
    sleep: {
      sensor: 'sleep',
      level: 'amber',
      phase: 'confirmed',
      value: formatReadingValue('sleep_hours', sleep),
      outsideNormal: false,
      teamCriterion: false,
      reason: 'sleep_hours',
    },
    pressure: greenReading('pressure', formatReadingValue('blood_pressure', observations[2])),
    pulse: greenReading('pulse', formatReadingValue('resting_heart_rate', observations[3])),
    oxygen: greenReading('oxygen', formatReadingValue('oxygen_saturation', observations[4])),
    temperature: greenReading('temperature', formatReadingValue('body_temperature', observations[5])),
  };
  return CheckRecord.parse({
    id: at,
    observations,
    symptoms: ['none'],
    readings,
    verdict: 'attention',
    actionKey: 'action.slept_little',
    simulated: false,
  });
}
