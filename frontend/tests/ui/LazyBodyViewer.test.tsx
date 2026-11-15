/**
 * Tests for the body switch (T079, CL5): WebGL missing → fallback at once; while the model loads, the
 * fallback is shown underneath; `onLoaded` → the fallback is removed; model not loaded within
 * BODY_LOAD_TIMEOUT_MS → fallback; loading throws → fallback.
 * `BodyViewer` is mocked, since jsdom has no WebGL and no real GLTF loader.
 */
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { LazyBodyViewer } from '../../src/ui/body3d/LazyBodyViewer';
import { BODY_LOAD_TIMEOUT_MS } from '../../src/config/constants';
import { t } from '../../src/config/messages.es';

const mock = vi.hoisted(() => ({
  mode: 'never' as 'never' | 'loaded' | 'throw',
  mounts: 0,
}));

vi.mock('../../src/ui/body3d/BodyViewer', async () => {
  const React = await import('react');
  return {
    BodyViewer: function MockBodyViewer({ onLoaded }: { onLoaded?: () => void }) {
      mock.mounts += 1;
      React.useEffect(() => {
        if (mock.mode === 'loaded') onLoaded?.();
      }, [onLoaded]);
      if (mock.mode === 'throw') throw new Error('GLTF failed to load');
      return <div data-testid="body-viewer" />;
    },
  };
});

const props = { readings: [], focus: null, evaluated: false, onSensorTap: () => {} };

/** Are we showing the fallback image? */
const fallbackShown = () => screen.queryByRole('img', { name: t('body.fallbackAlt') }) !== null;

function stubWebGL(available: boolean) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() =>
    available ? ({} as RenderingContext) : null,
  );
}

beforeAll(async () => {
  // Load the mocked module before any fake timers start, so the lazy import is not timed.
  await import('../../src/ui/body3d/BodyViewer');
});

beforeEach(() => {
  mock.mode = 'never';
  mock.mounts = 0;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LazyBodyViewer switch', () => {
  it('shows the fallback at once when WebGL is unavailable, without loading the 3D body', () => {
    stubWebGL(false);
    render(<LazyBodyViewer {...props} />);
    expect(fallbackShown()).toBe(true);
    expect(mock.mounts).toBe(0);
  });

  it('shows the fallback underneath while the model loads, not a blank box', async () => {
    stubWebGL(true);
    render(<LazyBodyViewer {...props} />);

    expect(await screen.findByTestId('body-viewer')).toBeInTheDocument();
    expect(fallbackShown()).toBe(true);
    expect(screen.getByTestId('body-placeholder')).toHaveClass('absolute');
  });

  it('switches to the fallback when the model is not loaded within the timeout', () => {
    vi.useFakeTimers();
    stubWebGL(true);
    render(<LazyBodyViewer {...props} />);
    expect(screen.queryByTestId('body-viewer')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(BODY_LOAD_TIMEOUT_MS - 1);
    });
    expect(screen.queryByTestId('body-viewer')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('body-viewer')).toBeNull();
    expect(fallbackShown()).toBe(true);
    expect(screen.queryByTestId('body-placeholder')).toBeNull();
  });

  it('removes the fallback placeholder once the model reports loaded', async () => {
    stubWebGL(true);
    mock.mode = 'loaded';
    render(<LazyBodyViewer {...props} />);

    expect(await screen.findByTestId('body-viewer')).toBeInTheDocument();
    await waitFor(() => expect(fallbackShown()).toBe(false));
    expect(screen.queryByTestId('body-placeholder')).toBeNull();
  });

  it('switches to the fallback when loading the body throws', async () => {
    stubWebGL(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mock.mode = 'throw';
    render(<LazyBodyViewer {...props} />);
    expect(await screen.findByRole('img', { name: t('body.fallbackAlt') })).toBeInTheDocument();
  });

  it('keeps the 3D body when the model reports loaded, even after the timeout', async () => {
    vi.useFakeTimers();
    stubWebGL(true);
    mock.mode = 'loaded';
    render(<LazyBodyViewer {...props} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BODY_LOAD_TIMEOUT_MS + 1000);
    });
    expect(screen.getByTestId('body-viewer')).toBeInTheDocument();
    expect(fallbackShown()).toBe(false);
  });

  it('while loading, the 3D layer takes no taps, so the fallback dots under it stay tappable', async () => {
    stubWebGL(true);
    render(<LazyBodyViewer {...props} />);

    await screen.findByTestId('body-viewer');
    expect(screen.getByTestId('body-viewer-layer')).toHaveClass('pointer-events-none');
    expect(screen.getByTestId('body-placeholder')).toBeInTheDocument();
  });

  it('after the model is drawn, the 3D layer takes taps again', async () => {
    stubWebGL(true);
    mock.mode = 'loaded';
    render(<LazyBodyViewer {...props} />);

    await waitFor(() => expect(fallbackShown()).toBe(false));
    expect(screen.getByTestId('body-viewer-layer')).not.toHaveClass('pointer-events-none');
  });
});
