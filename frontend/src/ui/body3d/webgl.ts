/**
 * Does this browser offer WebGL (CL5)? Asks a canvas for `webgl2`, then `webgl`. The canvas factory
 * is injectable so tests can pass a fake. Any exception counts as "no WebGL".
 */
export function hasWebGL(
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): boolean {
  try {
    const canvas = createCanvas();
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
