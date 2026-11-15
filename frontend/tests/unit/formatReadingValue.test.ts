/**
 * Display text of a sensor's primary value (`SensorReading.value`). Units come from
 * messages.es.ts; the temperature always has one decimal (SC-011 shows "5 h").
 */
import { describe, it, expect } from 'vitest';
import { Observation, type Indicator } from '@base-vital/contracts';
import { formatReadingValue } from '../../src/application/use-cases/formatReadingValue';
import { setLocale } from '../../src/config/i18n';

const AT = '2026-11-15T07:00:00.000Z';

const observe = (indicator: Indicator, value: number | { systolic: number; diastolic: number }) =>
  Observation.parse({
    indicator,
    value,
    source: indicator === 'sleep_hours' || indicator === 'mood' ? 'voice' : 'device',
    confirmed: true,
    simulated: false,
    at: AT,
  });

describe('formatReadingValue', () => {
  it.each<[Indicator, number | { systolic: number; diastolic: number }, string]>([
    ['sleep_hours', 5, '5 h'],
    ['sleep_hours', 7.5, '7,5 h'],
    ['mood', 4, '4'],
    ['resting_heart_rate', 72, '72 lpm'],
    ['oxygen_saturation', 98, '98 %'],
    ['body_temperature', 36.8, '36,8 °C'],
    ['body_temperature', 36, '36,0 °C'],
  ])('formats %s %s as "%s"', (indicator, value, expected) => {
    expect(formatReadingValue(indicator, observe(indicator, value))).toBe(expected);
  });

  it('formats blood pressure as systolic/diastolic', () => {
    expect(
      formatReadingValue('blood_pressure', observe('blood_pressure', { systolic: 118, diastolic: 76 })),
    ).toBe('118/76 mmHg');
  });

  it('shows the dash when there is no observation', () => {
    expect(formatReadingValue('body_temperature', undefined)).toBe('—');
  });

  it('shows the dash when the observation is of another indicator', () => {
    expect(formatReadingValue('body_temperature', observe('oxygen_saturation', 97))).toBe('—');
  });
});

describe('formatReadingValue follows the UI locale for numbers', () => {
  it('writes 7.5 h and 36.8 °C with a decimal point in English', () => {
    setLocale('en');
    expect(formatReadingValue('sleep_hours', observe('sleep_hours', 7.5))).toBe('7.5 h');
    expect(formatReadingValue('body_temperature', observe('body_temperature', 36.8))).toBe('36.8 °C');
    expect(formatReadingValue('body_temperature', observe('body_temperature', 36))).toBe('36.0 °C');
  });

  it('keeps the decimal comma in Spanish', () => {
    setLocale('es');
    expect(formatReadingValue('sleep_hours', observe('sleep_hours', 7.5))).toBe('7,5 h');
    expect(formatReadingValue('body_temperature', observe('body_temperature', 36.8))).toBe('36,8 °C');
  });
});
