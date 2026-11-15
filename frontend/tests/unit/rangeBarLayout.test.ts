/**
 * Pure layout of one metric range bar (ui-build §3 #4, design "Metric row").
 *
 * Return shape (defined here; the implementation must match it):
 * - zones: contiguous segments covering 0–100 % of the scale, in ascending order. `level` is the
 *   `Level` whose band owns the segment (`green` = "allowed", `amber` = "attention",
 *   `red` = "alert", `in_doubt` = temperature [35.0, 36.1) °C, `unknown` = no band covers it).
 *   D32: a conditional red band (`consecutiveForRed`, pulse < 50 needing symptoms) is drawn
 *   `amber`; only unconditional red bands are drawn `red`. Adjacent same-level zones are merged,
 *   so a cut only appears where the drawn level changes.
 * - markerPct: where the value sits on the scale, clamped to 0–100; `null` when there is no value.
 * - baselinePct: "tu normal" bracket `{ from, to }` = mean ± 2·sd, clamped to 0–100; `null` when
 *   the baseline is missing, not ready, or for another indicator.
 * - cuts: zone boundaries strictly inside the scale (scale ends are never cuts), with the raw
 *   threshold `value` for the labels line.
 */
import { describe, it, expect } from 'vitest';
import type { Baseline, SensorKey } from '@base-vital/contracts';
import { computeRangeBar } from '../../src/ui/components/rangeBarLayout';

type ZoneLevel = 'green' | 'amber' | 'red' | 'in_doubt' | 'unknown';
interface RangeBarZone {
  level: ZoneLevel;
  fromPct: number;
  toPct: number;
}
interface RangeBarCut {
  pct: number;
  value: number;
}
interface RangeBarLayout {
  zones: RangeBarZone[];
  markerPct: number | null;
  baselinePct: { from: number; to: number } | null;
  cuts: RangeBarCut[];
}

/** Scales from docs/base-vital-home-data-mapping.md §1 (become UI_SCALES in T089). */
const SCALE = {
  pressure: [90, 160],
  pulse: [40, 130],
  oxygen: [85, 100],
  temperature: [35, 39],
  sleep: [0, 10],
} as const satisfies Record<SensorKey, readonly [number, number]>;

const baseline = (overrides: Partial<Baseline> & Pick<Baseline, 'indicator'>): Baseline => ({
  mean: 0,
  sd: 1,
  ready: true,
  ...overrides,
});

const pctOf = (value: number, [min, max]: readonly [number, number]) => ((value - min) / (max - min)) * 100;

describe('computeRangeBar', () => {
  describe('zones come from thresholds.ts and cover the scale', () => {
    it('blood pressure: green < 120, amber 120–140, red ≥ 140 on [90, 160] (systolic)', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'pressure',
        value: 118,
        baseline: null,
        scale: SCALE.pressure,
      });

      expect(layout.zones.map((z) => z.level)).toEqual(['green', 'amber', 'red']);
      expect(layout.zones[0].fromPct).toBeCloseTo(0, 5);
      expect(layout.zones[0].toPct).toBeCloseTo(pctOf(120, SCALE.pressure), 5);
      expect(layout.zones[1].toPct).toBeCloseTo(pctOf(140, SCALE.pressure), 5);
      expect(layout.zones[2].toPct).toBeCloseTo(100, 5);
    });

    it('zones are contiguous, start at 0 and end at 100, for every sensor', () => {
      const values: Record<SensorKey, number | { systolic: number; diastolic: number }> = {
        pressure: { systolic: 118, diastolic: 76 },
        pulse: 72,
        oxygen: 98,
        temperature: 36.8,
        sleep: 5,
      };
      for (const sensor of Object.keys(SCALE) as SensorKey[]) {
        const layout: RangeBarLayout = computeRangeBar({
          sensor,
          value: values[sensor],
          baseline: null,
          scale: SCALE[sensor],
        });
        const { zones } = layout;
        expect(zones[0].fromPct, sensor).toBeCloseTo(0, 5);
        expect(zones[zones.length - 1].toPct, sensor).toBeCloseTo(100, 5);
        for (let i = 0; i < zones.length; i += 1) {
          expect(zones[i].fromPct, `${sensor} zone ${i} ordered`).toBeLessThan(zones[i].toPct);
          if (i > 0) expect(zones[i].fromPct, `${sensor} zone ${i} contiguous`).toBeCloseTo(zones[i - 1].toPct, 5);
        }
      }
    });

    it('pulse: amber < 60 (red < 50 is conditional on symptoms, drawn amber), green 60–100, amber 101–110, red ≥ 111 on [40, 130]', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'pulse', value: 72, baseline: null, scale: SCALE.pulse });

      // Conditional red (< 50, needs symptoms) is drawn amber and merges with the amber below 60.
      expect(layout.zones.map((z) => z.level)).toEqual(['amber', 'green', 'amber', 'red']);
      expect(layout.zones[0].toPct).toBeCloseTo(pctOf(60, SCALE.pulse), 5);
      expect(layout.zones[1].toPct).toBeCloseTo(pctOf(101, SCALE.pulse), 5);
      expect(layout.zones[2].toPct).toBeCloseTo(pctOf(111, SCALE.pulse), 5);
    });

    it('unconditional red stays red: pulse ≥ 111 is red', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'pulse', value: 120, baseline: null, scale: SCALE.pulse });
      expect(layout.zones[layout.zones.length - 1]).toEqual({
        level: 'red',
        fromPct: pctOf(111, SCALE.pulse),
        toPct: 100,
      });
    });

    it('oxygen (one-sided): red < 90, amber 90–94.9, green ≥ 95 on [85, 100]', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'oxygen', value: 98, baseline: null, scale: SCALE.oxygen });

      expect(layout.zones.map((z) => z.level)).toEqual(['red', 'amber', 'green']);
      expect(layout.zones[0].toPct).toBeCloseTo(pctOf(90, SCALE.oxygen), 5);
      expect(layout.zones[1].toPct).toBeCloseTo(pctOf(95, SCALE.oxygen), 5);
    });

    it('sleep (one-sided): conditional red < 6 is drawn amber, merged with amber < 7; green ≥ 7 on [0, 10]', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'sleep', value: 5, baseline: null, scale: SCALE.sleep });

      expect(layout.zones.map((z) => z.level)).toEqual(['amber', 'green']);
      expect(layout.zones[0].toPct).toBeCloseTo(70, 5);
    });

    it('sleep 5 h on [0, 10]: the zone under the marker is amber (D32, SC-011)', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'sleep', value: 5, baseline: null, scale: [0, 10] });
      const zoneAtMarker = layout.zones.find(
        (z) => layout.markerPct !== null && layout.markerPct >= z.fromPct && layout.markerPct < z.toPct,
      );
      expect(layout.markerPct).toBeCloseTo(50, 5);
      expect(zoneAtMarker?.level).toBe('amber');
    });

    it('temperature: in_doubt 35.0–36.0, green 36.1–37.2, amber 37.3–37.9, red ≥ 38 on [35, 39]', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'temperature',
        value: 36.8,
        baseline: null,
        scale: SCALE.temperature,
      });

      expect(layout.zones.map((z) => z.level)).toEqual(['in_doubt', 'green', 'amber', 'red']);
      expect(layout.zones[0].toPct).toBeCloseTo(pctOf(36.1, SCALE.temperature), 5);
      expect(layout.zones[1].toPct).toBeCloseTo(pctOf(37.3, SCALE.temperature), 5);
      expect(layout.zones[2].toPct).toBeCloseTo(pctOf(38, SCALE.temperature), 5);
    });
  });

  describe('marker', () => {
    it('118 on [90, 160] → 40 %', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'pressure',
        value: 118,
        baseline: null,
        scale: [90, 160],
      });
      expect(layout.markerPct).toBeCloseTo(40, 5);
    });

    it('equals (value − min) / (max − min) for a non-pressure sensor', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'temperature', value: 36.8, baseline: null, scale: SCALE.temperature });
      expect(layout.markerPct).toBeCloseTo(((36.8 - 35) / (39 - 35)) * 100, 5);
    });

    it('blood pressure uses the systolic value only', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'pressure',
        value: { systolic: 118, diastolic: 95 },
        baseline: null,
        scale: [90, 160],
      });
      expect(layout.markerPct).toBeCloseTo(40, 5);
    });

    it('values outside the scale are clamped to 0 and 100', () => {
      const below = computeRangeBar({ sensor: 'pressure', value: 60, baseline: null, scale: [90, 160] });
      const above = computeRangeBar({ sensor: 'pressure', value: 200, baseline: null, scale: [90, 160] });
      expect(below.markerPct).toBe(0);
      expect(above.markerPct).toBe(100);
    });

    it('no value → markerPct null', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'pulse', value: null, baseline: null, scale: [40, 130] });
      expect(layout.markerPct).toBeNull();
    });
  });

  describe('baseline bracket ("tu normal")', () => {
    it('pulse: mean 72 ± 2·5 on [40, 130] → from 24.4 %, to 46.7 %', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'pulse',
        value: 72,
        baseline: baseline({ indicator: 'resting_heart_rate', mean: 72, sd: 5, ready: true }),
        scale: [40, 130],
      });
      expect(layout.baselinePct?.from).toBeCloseTo(((62 - 40) / 90) * 100, 5);
      expect(layout.baselinePct?.to).toBeCloseTo(((82 - 40) / 90) * 100, 5);
    });

    it('pressure: the bracket is built from the systolic baseline', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'pressure',
        value: 118,
        baseline: baseline({ indicator: 'systolic', mean: 118, sd: 3, ready: true }),
        scale: [90, 160],
      });
      expect(layout.baselinePct?.from).toBeCloseTo(((112 - 90) / 70) * 100, 5);
      expect(layout.baselinePct?.to).toBeCloseTo(((124 - 90) / 70) * 100, 5);
    });

    it('bracket ends outside the scale are clamped to 0 and 100', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'pulse',
        value: 72,
        baseline: baseline({ indicator: 'resting_heart_rate', mean: 45, sd: 20, ready: true }),
        scale: [40, 130],
      });
      expect(layout.baselinePct?.from).toBe(0);
      expect(layout.baselinePct?.to).toBeCloseTo(((85 - 40) / 90) * 100, 5);
    });

    it('baseline not ready → null', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'pulse',
        value: 72,
        baseline: baseline({ indicator: 'resting_heart_rate', mean: 72, sd: 5, ready: false }),
        scale: [40, 130],
      });
      expect(layout.baselinePct).toBeNull();
    });

    it('no baseline → null', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'pulse', value: 72, baseline: null, scale: [40, 130] });
      expect(layout.baselinePct).toBeNull();
    });

    it('baseline for another indicator than the sensor\'s → null', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'pulse',
        value: 72,
        baseline: baseline({ indicator: 'systolic', mean: 118, sd: 3, ready: true }),
        scale: [40, 130],
      });
      expect(layout.baselinePct).toBeNull();
    });
  });

  describe('cut points', () => {
    it('are the zone boundaries strictly inside the scale, with their threshold values', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'pulse', value: 72, baseline: null, scale: [40, 130] });
      // 50 is no longer a boundary: the conditional red below it is drawn amber, same as the zone above.
      expect(layout.cuts.map((c) => c.value)).toEqual([60, 101, 111]);
      expect(layout.cuts[0].pct).toBeCloseTo(pctOf(60, [40, 130]), 5);
    });

    it('never include the scale ends (temperature 35 and 39 are not cuts)', () => {
      const layout: RangeBarLayout = computeRangeBar({
        sensor: 'temperature',
        value: 36.8,
        baseline: null,
        scale: [35, 39],
      });
      expect(layout.cuts.map((c) => c.value)).toEqual([36.1, 37.3, 38]);
    });

    it('oxygen cuts are 90 and 95; sleep cut is 7 (6 is a conditional red drawn amber, D32)', () => {
      const oxygen: RangeBarLayout = computeRangeBar({ sensor: 'oxygen', value: 98, baseline: null, scale: [85, 100] });
      const sleep: RangeBarLayout = computeRangeBar({ sensor: 'sleep', value: 5, baseline: null, scale: [0, 10] });
      expect(oxygen.cuts.map((c) => c.value)).toEqual([90, 95]);
      expect(sleep.cuts.map((c) => c.value)).toEqual([7]);
    });

    it('blood pressure cuts are 120 and 140', () => {
      const layout: RangeBarLayout = computeRangeBar({ sensor: 'pressure', value: 118, baseline: null, scale: [90, 160] });
      expect(layout.cuts.map((c) => c.value)).toEqual([120, 140]);
    });
  });
});
