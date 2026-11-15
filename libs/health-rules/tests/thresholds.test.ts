/**
 * Source checks for the RN1 thresholds (Principle VIII, research R9).
 *
 * Expected shape of `THRESHOLDS` (implemented in T066, `src/thresholds.ts`):
 * - An array of `Threshold` entries (contracts schema), one entry per band group.
 *   Each entry has `indicator` (`Indicator`), `green`/`amber`/`red` range bands,
 *   optional `consecutiveForRed`, optional `source`, and `sourceStatus`.
 * - `blood_pressure`: cited AHA/ACC 2025.
 * - `resting_heart_rate`: green 60–100 cited AHA; the amber/red bands are a
 *   `team_criterion` entry.
 * - `sleep_hours`: green ≥ 7 h cited AASM/SRS; the 3-night red rule is a
 *   `team_criterion` entry.
 * - `body_temperature`: normal cites MedlinePlus, fever cites CDC, hypothermia
 *   cites Mayo Clinic (one entry each for those bands).
 * - `oxygen_saturation`: cited WHO Pulse Oximetry Training Manual.
 * - `mood`: `team_criterion` only.
 */
import { describe, it, expect } from 'vitest';
import { Threshold } from '@base-vital/contracts';
import { THRESHOLDS } from '../src/thresholds';

type Expectation = {
  indicator: Threshold['indicator'];
  sourceStatus: Threshold['sourceStatus'];
  source: RegExp;
  description: string;
};

/** Each entry must exist somewhere in THRESHOLDS for its indicator. */
const EXPECTED: Expectation[] = [
  {
    indicator: 'blood_pressure',
    sourceStatus: 'cited',
    source: /AHA\/ACC 2025/,
    description: 'blood pressure bands cite AHA/ACC 2025',
  },
  {
    indicator: 'resting_heart_rate',
    sourceStatus: 'cited',
    source: /American Heart Association|AHA/,
    description: 'pulse green band 60–100 cites AHA',
  },
  {
    indicator: 'resting_heart_rate',
    sourceStatus: 'team_criterion',
    source: /.*/,
    description: 'pulse amber/red bands are a team criterion',
  },
  {
    indicator: 'sleep_hours',
    sourceStatus: 'cited',
    source: /AASM\/SRS/,
    description: 'sleep green band ≥ 7 h cites AASM/SRS',
  },
  {
    indicator: 'sleep_hours',
    sourceStatus: 'team_criterion',
    source: /.*/,
    description: 'sleep 3-night red rule is a team criterion',
  },
  {
    indicator: 'body_temperature',
    sourceStatus: 'cited',
    source: /MedlinePlus/,
    description: 'normal temperature 36.1–37.2 °C cites MedlinePlus',
  },
  {
    indicator: 'body_temperature',
    sourceStatus: 'cited',
    source: /CDC/,
    description: 'fever ≥ 38.0 °C cites CDC',
  },
  {
    indicator: 'body_temperature',
    sourceStatus: 'cited',
    source: /Mayo Clinic/,
    description: 'hypothermia < 35.0 °C cites Mayo Clinic',
  },
  {
    indicator: 'oxygen_saturation',
    sourceStatus: 'cited',
    source: /WHO Pulse Oximetry Training Manual/,
    description: 'SpO₂ bands cite the WHO Pulse Oximetry Training Manual',
  },
  {
    indicator: 'mood',
    sourceStatus: 'team_criterion',
    source: /.*/,
    description: 'mood is a team criterion',
  },
];

describe('THRESHOLDS (RN1 sources)', () => {
  it('every entry parses with the Threshold schema', () => {
    for (const entry of THRESHOLDS) {
      expect(() => Threshold.parse(entry), JSON.stringify(entry)).not.toThrow();
    }
  });

  it('every entry has a non-empty source unless sourceStatus is team_criterion', () => {
    for (const entry of THRESHOLDS) {
      if (entry.sourceStatus === 'team_criterion') continue;
      expect(entry.source, `${entry.indicator} source`).toBeTruthy();
      expect(entry.source?.trim().length, `${entry.indicator} source`).toBeGreaterThan(0);
    }
  });

  it('every sourced entry is cited (none to_verify)', () => {
    for (const entry of THRESHOLDS) {
      if (entry.sourceStatus === 'team_criterion') continue;
      expect(entry.sourceStatus, `${entry.indicator} ${entry.source}`).toBe('cited');
    }
    expect(THRESHOLDS.some((entry) => entry.sourceStatus === 'to_verify')).toBe(false);
  });

  for (const expected of EXPECTED) {
    it(`has ${expected.sourceStatus} source for ${expected.indicator}: ${expected.description}`, () => {
      const matches = THRESHOLDS.filter(
        (entry) =>
          entry.indicator === expected.indicator &&
          entry.sourceStatus === expected.sourceStatus &&
          (expected.sourceStatus === 'team_criterion' || expected.source.test(entry.source ?? '')),
      );
      expect(matches.length, expected.description).toBeGreaterThan(0);
    });
  }

  it('mood entries are all team_criterion', () => {
    const mood = THRESHOLDS.filter((entry) => entry.indicator === 'mood');
    expect(mood.length).toBeGreaterThan(0);
    for (const entry of mood) {
      expect(entry.sourceStatus).toBe('team_criterion');
    }
  });
});
