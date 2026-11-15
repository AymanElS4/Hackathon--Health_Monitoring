/**
 * Tests for the WebGL probe used by the body fallback switch (T079, CL5). The canvas is faked
 * through the injectable factory, since jsdom has no WebGL.
 */
import { describe, it, expect } from 'vitest';
import { hasWebGL } from '../../src/ui/body3d/webgl';

function fakeCanvas(contexts: Record<string, unknown>): () => HTMLCanvasElement {
  return () =>
    ({
      getContext: (kind: string) => contexts[kind] ?? null,
    }) as unknown as HTMLCanvasElement;
}

describe('hasWebGL', () => {
  it('is true when webgl2 is available', () => {
    expect(hasWebGL(fakeCanvas({ webgl2: {} }))).toBe(true);
  });

  it('is true when only webgl (version 1) is available', () => {
    expect(hasWebGL(fakeCanvas({ webgl: {} }))).toBe(true);
  });

  it('is false when neither context is available', () => {
    expect(hasWebGL(fakeCanvas({}))).toBe(false);
  });

  it('is false when probing the canvas throws', () => {
    const broken = () => {
      throw new Error('no canvas');
    };
    expect(hasWebGL(broken)).toBe(false);
  });
});
