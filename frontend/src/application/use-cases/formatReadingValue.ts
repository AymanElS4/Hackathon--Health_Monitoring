/**
 * Display text of a sensor's primary observation (`SensorReading.value`), e.g. "118/76", "5 h",
 * "36,8 °C" (or "36.8 °C" in English). Units and wording come from the message catalogs (Principle II);
 * numbers go through `formatNumber` in the UI locale, except the temperature, which always shows one decimal.
 */
import type { Indicator, Observation } from '@base-vital/contracts';
import { formatNumber, t } from '../../config/messages.es';
import { getLocale, type Locale } from '../../config/i18n';

/** Temperature always has exactly one decimal: 36 → "36,0" (es) or "36.0" (en). */
const TEMPERATURE_FORMAT: Readonly<Record<Locale, Intl.NumberFormat>> = {
  es: new Intl.NumberFormat('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
};

export function formatReadingValue(indicator: Indicator, observation: Observation | undefined): string {
  if (observation === undefined || observation.indicator !== indicator) return t('value.missing');
  const locale = getLocale();
  switch (observation.indicator) {
    case 'sleep_hours':
      return t('value.sleep_hours', { value: formatNumber(observation.value, locale) });
    case 'blood_pressure':
      return t('value.blood_pressure', {
        systolic: formatNumber(observation.value.systolic, locale),
        diastolic: formatNumber(observation.value.diastolic, locale),
      });
    case 'resting_heart_rate':
      return t('value.resting_heart_rate', { value: formatNumber(observation.value, locale) });
    case 'body_temperature':
      return t('value.body_temperature', { value: TEMPERATURE_FORMAT[locale].format(observation.value) });
    case 'oxygen_saturation':
      return t('value.oxygen_saturation', { value: formatNumber(observation.value, locale) });
    case 'mood':
      return t('value.mood', { value: formatNumber(observation.value, locale) });
  }
}
