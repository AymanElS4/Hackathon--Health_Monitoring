import { describe, it, expect } from 'vitest';
import type { DemoScenario } from '@base-vital/contracts';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import { pulseSeriesFor } from '../../src/application/use-cases/pulseSeries';

/** Clone a demo scenario and override some of its device values. */
function withDevices(
  base: DemoScenario,
  devices: Partial<DemoScenario['devices']>,
): DemoScenario {
  return { ...base, devices: { ...base.devices, ...devices } };
}

describe('pulseSeriesFor', () => {
  it('filters the series to 60–100 bpm, keeping order', () => {
    expect(pulseSeriesFor(DEMO_SCENARIOS.normal, [50, 72, 110, 80, 101, 59, 90])).toEqual([
      72, 80, 90,
    ]);
  });

  it('keeps the band edges 60 and 100', () => {
    expect(pulseSeriesFor(DEMO_SCENARIOS.normal, [60, 100, 59.9, 100.1])).toEqual([60, 100]);
  });

  it('falls back to the scenario pulse when the series is missing or empty', () => {
    expect(pulseSeriesFor(DEMO_SCENARIOS.ca4)).toEqual([72]);
    expect(pulseSeriesFor(DEMO_SCENARIOS.ca4, [])).toEqual([72]);
  });

  it('falls back to the scenario pulse when no value is in range', () => {
    expect(pulseSeriesFor(DEMO_SCENARIOS.normal, [150, 40, 20])).toEqual([64]);
  });

  it('ignores non-finite values', () => {
    expect(pulseSeriesFor(DEMO_SCENARIOS.normal, [NaN, 70, Infinity])).toEqual([70]);
  });

  it('returns an empty list when the scenario has no pulse', () => {
    const noPulse = withDevices(DEMO_SCENARIOS.normal, { resting_heart_rate: null });
    expect(pulseSeriesFor(noPulse, [70, 80])).toEqual([]);
    expect(pulseSeriesFor(noPulse)).toEqual([]);
  });
});
