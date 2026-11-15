import { describe, it, expect } from 'vitest';
import { SENSOR_COLORS, LEVEL_COLORS } from '../../src/config/constants';
import { TOKENS } from '../../src/config/design-tokens';
import { SensorKey } from '@base-vital/contracts';

const HEX = /^#[0-9a-f]{3,8}$/i;

/** Collects every hex color string found anywhere inside a (possibly nested) value. */
function collectHex(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (HEX.test(value)) out.push(value.toLowerCase());
  } else if (Array.isArray(value)) {
    for (const item of value) collectHex(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) collectHex(item, out);
  }
  return out;
}

describe('SENSOR_COLORS', () => {
  it('has exactly the 5 SensorKey keys', () => {
    expect(Object.keys(SENSOR_COLORS).sort()).toEqual([...SensorKey.options].sort());
    expect(Object.keys(SENSOR_COLORS)).toHaveLength(5);
  });

  it('maps every sensor to a hex color', () => {
    for (const key of SensorKey.options) {
      expect(SENSOR_COLORS[key]).toMatch(HEX);
    }
  });
});

describe('LEVEL_COLORS', () => {
  it('has the keys green, amber, red, in_doubt and unknown', () => {
    expect(Object.keys(LEVEL_COLORS).sort()).toEqual(
      ['amber', 'green', 'in_doubt', 'red', 'unknown'],
    );
  });

  it('green has no ring (ring is null)', () => {
    const green = (LEVEL_COLORS as unknown as Record<string, { ring: unknown }>).green;
    expect(green.ring).toBeNull();
  });
});

describe('color tables do not share values', () => {
  it('SENSOR_COLORS and LEVEL_COLORS share no hex value (case-insensitive)', () => {
    const sensorHex = new Set(collectHex(SENSOR_COLORS));
    const levelHex = collectHex(LEVEL_COLORS);

    expect(sensorHex.size).toBe(5);
    expect(levelHex.length).toBeGreaterThan(0);

    const shared = levelHex.filter((hex) => sensorHex.has(hex));
    expect(shared).toEqual([]);
  });

  it('the neutral hairline TOKENS.color.line is in neither table', () => {
    const line = TOKENS.color.line.toLowerCase();
    expect(collectHex(SENSOR_COLORS)).not.toContain(line);
    expect(collectHex(LEVEL_COLORS)).not.toContain(line);
  });
});
