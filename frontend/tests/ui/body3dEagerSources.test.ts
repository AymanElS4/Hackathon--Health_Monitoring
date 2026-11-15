/**
 * Guard for the main bundle (T078 follow-up): the body modules that the eagerly loaded screens import
 * must not import three.js or React Three Fiber / drei. Only `BodyViewer` and what it imports may.
 * The sources are read as raw text (Vite glob), like `designTokens.test.ts`, because the frontend
 * has no Node typings.
 */
import { describe, it, expect } from 'vitest';

const EAGER_SOURCES = import.meta.glob(
  '../../src/ui/body3d/{LazyBodyViewer,BodyFallback,SensorCallout,SensorDot,bodyViewerModel}.{ts,tsx}',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** A static `from 'three'` / `from '@react-three/...'` import, or a dynamic `import('three')` of either. */
const HEAVY_IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*)['"](?:three(?:\/[^'"]*)?|@react-three\/[^'"]*)['"]/;

describe('eagerly loaded body modules', () => {
  it('finds the five eager sources', () => {
    expect(Object.keys(EAGER_SOURCES).map((path) => path.split('/').pop()).sort()).toEqual([
      'BodyFallback.tsx',
      'LazyBodyViewer.tsx',
      'SensorCallout.tsx',
      'SensorDot.tsx',
      'bodyViewerModel.ts',
    ]);
  });

  it.each(Object.keys(EAGER_SOURCES))('%s does not import three, react-three or drei', (path) => {
    expect(HEAVY_IMPORT.test(EAGER_SOURCES[path])).toBe(false);
  });

  it('the guard pattern does catch a three or react-three import', () => {
    expect(HEAVY_IMPORT.test("import { Vector3 } from 'three';")).toBe(true);
    expect(HEAVY_IMPORT.test("import { Html } from '@react-three/drei';")).toBe(true);
    expect(HEAVY_IMPORT.test("import type { Object3D } from 'three/src/core/Object3D';")).toBe(true);
    expect(HEAVY_IMPORT.test("import { SensorKey } from '@base-vital/contracts';")).toBe(false);
  });
});
