import { describe, expect, it } from 'vitest';
import { partName, splitBuffer } from '../../scripts/splitModelLogic';

describe('splitBuffer', () => {
  const data = Uint8Array.from({ length: 25 }, (_, i) => i);

  it('splits into ordered parts with a manifest', () => {
    const { manifest, parts } = splitBuffer('a.tar.gz', data, 'abc', 10);
    expect(parts.map((p) => p.name)).toEqual(['a.tar.gz.part00', 'a.tar.gz.part01', 'a.tar.gz.part02']);
    expect(manifest.parts.map((p) => p.size)).toEqual([10, 10, 5]);
    expect(manifest.size).toBe(25);
    expect(manifest.file).toBe('a.tar.gz');
    expect(manifest.sha256).toBe('abc');
    const joined = new Uint8Array(manifest.size);
    let offset = 0;
    for (const p of parts) {
      joined.set(p.bytes, offset);
      offset += p.bytes.length;
    }
    expect(joined).toEqual(data);
  });

  it('rejects an invalid part size', () => {
    expect(() => splitBuffer('a', data, 'abc', 0)).toThrow();
  });

  it('pads part indexes', () => {
    expect(partName('f', 3)).toBe('f.part03');
  });
});
