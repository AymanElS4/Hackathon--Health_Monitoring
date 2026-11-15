/**
 * Display text of a sensor's primary observation (`SensorReading.value`), e.g. "118/76", "5 h",
 * "36,8 °C". Units and wording come from messages.es.ts (Principle II); numbers go through
 * `formatNumber`, except the temperature, which always shows one decimal.
 */
import type { Indicator, Observation } from '@base-vital/contracts';
import { formatNumber, t } from '../../config/messages.es';

/** Temperature always has exactly one decimal: 36 → "36,0", 36.8 → "36,8". */
const TEMPERATURE_FORMAT = new Intl.NumberFormat('es', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatReadingValue(indicator: Indicator, observation: Observation | undefined): string {
  if (observation === undefined || observation.indicator !== indicator) return t('value.missing');
  switch (observation.indicator) {
    case 'sleep_hours':
      return t('value.sleep_hours', { value: formatNumber(observation.value) });
    case 'blood_pressure':
      return t('value.blood_pressure', {
        systolic: formatNumber(observation.value.systolic),
        diastolic: formatNumber(observation.value.diastolic),
      });
    case 'resting_heart_rate':
      return t('value.resting_heart_rate', { value: formatNumber(observation.value) });
    case 'body_temperature':
      return t('value.body_temperature', { value: TEMPERATURE_FORMAT.format(observation.value) });
    case 'oxygen_saturation':
      return t('value.oxygen_saturation', { value: formatNumber(observation.value) });
    case 'mood':
      return t('value.mood', { value: formatNumber(observation.value) });
  }
}
