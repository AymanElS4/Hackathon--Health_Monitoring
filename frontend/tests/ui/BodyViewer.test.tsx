/**
 * Tests for the 3D body scene settings (T078, RF6, ui-build §3 #2): the drei `Html` labels and the
 * `OrbitControls` limits. drei and React Three Fiber are mocked: jsdom has no WebGL. The mocks record
 * the props the scene passes, so the assertions read the configuration, not the pixels.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BodyViewer } from '../../src/ui/body3d/BodyViewer';
import {
  BODY_AZIMUTH_LIMIT_RAD,
  BODY_LABEL_Z_INDEX_RANGE,
  BODY_POLAR_ANGLE_RAD,
  REDUCED_MOTION_QUERY,
} from '../../src/config/constants';

const mock = vi.hoisted(() => ({
  controls: [] as Record<string, unknown>[],
  labels: [] as Record<string, unknown>[],
}));

vi.mock('@react-three/fiber', async () => {
  const React = await import('react');
  return {
    Canvas: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-testid': 'canvas' }, children),
    useThree: (selector?: (state: unknown) => unknown) => {
      const state = {
        size: { width: 240, height: 360 },
        camera: { position: { set: () => undefined }, lookAt: () => undefined },
      };
      return selector ? selector(state) : state;
    },
  };
});

vi.mock('@react-three/drei', async () => {
  const React = await import('react');
  const THREE = await import('three');
  // One body mesh and the five sensor nodes, as the .glb provides them (contracts/body-glb.md).
  const scene = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
  body.name = 'body';
  scene.add(body);
  for (const sensor of ['sleep', 'pulse', 'pressure', 'temperature', 'oxygen']) {
    const node = new THREE.Object3D();
    node.name = `sensor_${sensor}`;
    node.position.set(0.2, 0.5, 0.4);
    scene.add(node);
  }
  return {
    Html: (props: { children?: React.ReactNode }) => {
      mock.labels.push(props as Record<string, unknown>);
      return React.createElement('div', { 'data-testid': 'html-label' }, props.children);
    },
    OrbitControls: (props: Record<string, unknown>) => {
      mock.controls.push(props);
      return null;
    },
    useGLTF: Object.assign(() => ({ scene }), { preload: () => undefined }),
  };
});

interface MatchMediaStub {
  matches: boolean;
}

/** Stubs `matchMedia` so the reduced-motion query answers `reduced`. */
function stubReducedMotion(reduced: boolean): void {
  const query: MatchMediaStub & { addEventListener: () => void; removeEventListener: () => void } = {
    matches: reduced,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => {
      expect(media).toBe(REDUCED_MOTION_QUERY);
      return query as unknown as MediaQueryList;
    }),
  );
}

function renderBody(): void {
  render(<BodyViewer readings={[]} focus={null} evaluated={false} onSensorTap={() => undefined} />);
}

/**
 * The scene's R3F elements (`ambientLight`, `directionalLight`, `primitive`) are not DOM tags, so
 * react-dom warns about them when jsdom renders the scene. Those warnings are expected here; any other
 * console error still goes through.
 */
const R3F_TAG_WARNING = /(ambientLight|directionalLight|primitive)/;

beforeEach(() => {
  mock.controls.length = 0;
  mock.labels.length = 0;
  const original = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (args.some((arg) => typeof arg === 'string' && R3F_TAG_WARNING.test(arg))) return;
    original(...args);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BodyViewer labels', () => {
  it('draws one label per sensor node, each occluded and layered below the dock', () => {
    stubReducedMotion(false);
    renderBody();

    expect(mock.labels).toHaveLength(5);
    expect(screen.getAllByTestId('html-label')).toHaveLength(5);
    for (const label of mock.labels) {
      // Occluded by the body mesh only: drei raycasts that object, not the whole scene (CA5).
      const occluders = label.occlude as { current: { name: string } }[];
      expect(occluders).toHaveLength(1);
      expect(occluders[0].current.name).toBe('body');
      expect(label.zIndexRange).toEqual(BODY_LABEL_Z_INDEX_RANGE);
    }
  });
});

describe('BodyViewer orbit controls', () => {
  it('locks zoom and pan, and limits the turn to ±60° around the front view', () => {
    stubReducedMotion(false);
    renderBody();

    expect(mock.controls).toHaveLength(1);
    const controls = mock.controls[0];
    expect(controls.enableZoom).toBe(false);
    expect(controls.enablePan).toBe(false);
    expect(controls.autoRotate).toBe(false);
    expect(controls.minAzimuthAngle).toBe(-BODY_AZIMUTH_LIMIT_RAD);
    expect(controls.maxAzimuthAngle).toBe(BODY_AZIMUTH_LIMIT_RAD);
    expect(controls.minPolarAngle).toBe(BODY_POLAR_ANGLE_RAD);
    expect(controls.maxPolarAngle).toBe(BODY_POLAR_ANGLE_RAD);
  });

  it('turns damping off when the user prefers reduced motion', () => {
    stubReducedMotion(true);
    renderBody();

    expect(mock.controls[0].enableDamping).toBe(false);
  });

  it('turns damping on when the user does not prefer reduced motion', () => {
    stubReducedMotion(false);
    renderBody();

    expect(mock.controls[0].enableDamping).toBe(true);
  });
});
