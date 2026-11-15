import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { FPS_WINDOW_MS, MS_PER_SECOND } from '../../config/constants';

interface FpsMeterProps {
  /** Called once per window with the average frame rate of that window. */
  onFps: (fps: number) => void;
}

/**
 * Dev-only frame-rate meter for the 3D canvas (T095): counts the frames of the render loop and
 * reports the average of each window. Renders nothing. `BodyViewer` mounts it only when a caller
 * asks for frame rates, and loads it lazily, so the demo does not pay for it.
 */
export default function FpsMeter({ onFps }: FpsMeterProps) {
  const latestOnFps = useRef(onFps);
  const sample = useRef({ frames: 0, elapsedMs: 0 });

  useEffect(() => {
    latestOnFps.current = onFps;
  }, [onFps]);

  useFrame((_state, delta) => {
    const current = sample.current;
    current.frames += 1;
    current.elapsedMs += delta * MS_PER_SECOND;
    if (current.elapsedMs < FPS_WINDOW_MS) return;
    latestOnFps.current(Math.round((current.frames * MS_PER_SECOND) / current.elapsedMs));
    current.frames = 0;
    current.elapsedMs = 0;
  });

  return null;
}
