/**
 * Design tokens (ui-build spec §2, kept from DESIGN.md).
 *
 * Shape expected from `frontend/src/config/design-tokens.ts` (T033):
 *
 *   export const TOKENS = {
 *     font: {
 *       family: string;                 // includes 'Inter'
 *       size: Record<string, number>;   // px scale; smallest value is 13
 *     },
 *     color: {
 *       canvas: string;                 // '#F5F8FC'
 *       card: string;                   // '#FFFFFF'
 *       primary: string;                // '#2F6FED'
 *       primaryHover: string;           // '#2559C7'
 *       track: string;                  // '#E8F1FE'
 *       text: string;                   // '#1E2B3C'
 *       textSecondary: string;          // '#6B7A8F'
 *       rangeAllowed: string;           // '#4A90E2' (range-bar allowed zone)
 *     },
 *     radius: { card: number };         // px, 16..24
 *     shadow: { ambient: string };      // '0 4px 20px -2px rgba(30,43,60,0.06)'
 *     size: {
 *       touchTarget: number;            // px, 48
 *       navTouchTarget: number;         // px, 56
 *     },
 *   };
 *
 * Also checks `LEVEL_COLORS.green` (`label`, `bg`) from `src/config/constants.ts`
 * and scans every file under `src/ui/**` for hex color literals.
 */
import { describe, it, expect } from 'vitest';
import { TOKENS } from '../../src/config/design-tokens';
import { LEVEL_COLORS } from '../../src/config/constants';

const HEX_LITERAL = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/;

/**
 * Every file under `src/ui/**`, read as raw text. Uses Vite's glob import
 * instead of `node:fs` because the frontend has no Node typings and
 * `tsc --noEmit` (part of `npm run build`) includes this test file.
 */
const UI_SOURCES = import.meta.glob('../../src/ui/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('font', () => {
  it('uses the Inter family', () => {
    expect(TOKENS.font.family).toContain('Inter');
  });

  it('has a smallest font size of exactly 13 px', () => {
    const sizes = Object.values(TOKENS.font.size);
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBe(13);
  });

  it('has no font size below 13 px anywhere in the scale', () => {
    for (const [name, px] of Object.entries(TOKENS.font.size)) {
      expect(px, `font size "${name}"`).toBeGreaterThanOrEqual(13);
    }
  });
});

describe('spacing', () => {
  it('has the xs, sm, md, lg, xl steps as positive px values in ascending order', () => {
    const steps = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
    const values = steps.map((name) => TOKENS.spacing[name]);
    for (const [index, value] of values.entries()) {
      expect(value, `spacing "${steps[index]}"`).toBeGreaterThan(0);
    }
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe('colors', () => {
  const expected: Record<keyof typeof TOKENS.color, string> = {
    canvas: '#F5F8FC',
    card: '#FFFFFF',
    primary: '#2F6FED',
    primaryHover: '#2559C7',
    track: '#E8F1FE',
    text: '#1E2B3C',
    textSecondary: '#6B7A8F',
    rangeAllowed: '#4A90E2',
    line: '#D5DCE5',
    baseline: '#DDE3EA',
  };

  for (const [name, hex] of Object.entries(expected)) {
    it(`${name} is ${hex} (case-insensitive)`, () => {
      const actual = TOKENS.color[name as keyof typeof TOKENS.color];
      expect(actual.toLowerCase()).toBe(hex.toLowerCase());
    });
  }
});

describe('shape', () => {
  it('card radius is between 16 and 24 px', () => {
    expect(TOKENS.radius.card).toBeGreaterThanOrEqual(16);
    expect(TOKENS.radius.card).toBeLessThanOrEqual(24);
  });

  it('ambient shadow is exactly 0 4px 20px -2px rgba(30,43,60,0.06)', () => {
    expect(TOKENS.shadow.ambient).toBe('0 4px 20px -2px rgba(30,43,60,0.06)');
  });

  it('touch target is 48 px', () => {
    expect(TOKENS.size.touchTarget).toBe(48);
  });

  it('nav touch target is 56 px', () => {
    expect(TOKENS.size.navTouchTarget).toBe(56);
  });
});

describe('LEVEL_COLORS.green', () => {
  // `bg` is added to the table in T033; cast so this file type-checks before that.
  const green = LEVEL_COLORS.green as { label: string; bg?: string };

  it("label is '#64748B' (case-insensitive)", () => {
    expect(green.label.toLowerCase()).toBe('#64748b');
  });

  it("bg is '#EEF2F6' (case-insensitive)", () => {
    expect(green.bg).toBeDefined();
    expect(green.bg!.toLowerCase()).toBe('#eef2f6');
  });
});

describe('source scan: src/ui/**', () => {
  const files = Object.keys(UI_SOURCES);

  it('finds the UI source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('contains no hex color literal in any file', () => {
    const offenders = files
      .filter((file) => HEX_LITERAL.test(UI_SOURCES[file]))
      .map((file) => {
        const match = UI_SOURCES[file].match(HEX_LITERAL);
        return `${file}: ${match?.[0] ?? ''}`;
      });
    expect(offenders).toEqual([]);
  });
});
