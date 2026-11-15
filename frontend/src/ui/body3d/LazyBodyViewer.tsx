import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BODY_LOAD_TIMEOUT_MS } from '../../config/constants';
import { BodyFallback, type BodyFallbackProps } from './BodyFallback';
import { hasWebGL } from './webgl';

/**
 * Code-split entry for `BodyViewer`. three.js, React Three Fiber and drei load only when a screen
 * first renders the body, so they stay out of the main bundle.
 */
const BodyViewer = lazy(() => import('./BodyViewer').then((module) => ({ default: module.BodyViewer })));

/**
 * Where the body is: still loading, drawn, or replaced by the fallback image (CL5). `failed` is
 * final for this mount.
 */
type ViewerPhase = 'loading' | 'loaded' | 'failed';

interface ErrorBoundaryProps {
  onError: () => void;
  children: ReactNode;
}

/** Catches a throw from the lazy chunk or the 3D scene and tells the switch to show the fallback. */
class ViewerErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The 3D body with its fallback switch (CL5, ui-build §3 #2). Shows `BodyFallback` at once when
 * WebGL is unavailable. Otherwise shows `BodyViewer` over a `BodyFallback` placeholder: the
 * placeholder is removed when the model reports loaded. The viewer is replaced by the fallback if
 * the model is not loaded within `BODY_LOAD_TIMEOUT_MS` or if loading throws.
 */
export function LazyBodyViewer(props: BodyFallbackProps) {
  const [webgl] = useState(() => hasWebGL());
  const [phase, setPhase] = useState<ViewerPhase>(webgl ? 'loading' : 'failed');

  useEffect(() => {
    if (phase !== 'loading') return undefined;
    const timer = setTimeout(() => setPhase('failed'), BODY_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // The body area is at least `size.bodyArea` tall and takes the free height of its column. Every
  // layer is absolute inside it, so the 3D view and the fallback both fill the same box. While
  // loading, the fallback is underneath; the canvas comes later in the DOM and is transparent.
  return (
    <div className="relative min-h-bodyArea w-full flex-1">
      {phase === 'failed' ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <BodyFallback {...props} />
        </div>
      ) : (
        <>
          {phase === 'loading' && (
            <div data-testid="body-placeholder" className="absolute inset-0 flex items-center justify-center">
              <BodyFallback {...props} />
            </div>
          )}
          {/* While loading, the canvas is transparent but covers the placeholder: it must not take taps. */}
          <div
            data-testid="body-viewer-layer"
            className={`absolute inset-0 ${phase === 'loading' ? 'pointer-events-none' : ''}`}
          >
            <ViewerErrorBoundary onError={() => setPhase('failed')}>
              <Suspense fallback={null}>
                <BodyViewer {...props} onLoaded={() => setPhase('loaded')} />
              </Suspense>
            </ViewerErrorBoundary>
          </div>
        </>
      )}
    </div>
  );
}
