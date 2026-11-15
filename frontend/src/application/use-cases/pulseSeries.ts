import type { DemoScenario } from '@base-vital/contracts';

// Use case: pulse values for history seeding (T088). Pure: no I/O, no globals. The WESAD
// series is passed in by the caller; this module does not load it.

const NOMINAL_PULSE_MIN = 60;
const NOMINAL_PULSE_MAX = 100;

/**
 * Pulse values (bpm) for history seeding: the series filtered to the nominal 60–100 band.
 * Falls back to `[scenario pulse]` when the series is missing, empty, or has no value in
 * range, and to `[]` when the scenario has no pulse at all.
 * Every scenario is treated as "as normal" (research R14), so the band is fixed.
 */
export function pulseSeriesFor(scenario: DemoScenario, series?: number[]): number[] {
  const scenarioPulse = scenario.devices.resting_heart_rate;
  if (scenarioPulse === null) {
    return [];
  }
  const inBand = (series ?? []).filter(
    (bpm) => Number.isFinite(bpm) && bpm >= NOMINAL_PULSE_MIN && bpm <= NOMINAL_PULSE_MAX,
  );
  return inBand.length > 0 ? inBand : [scenarioPulse];
}
