/**
 * Dev-only metrics overlay (T095). The check-in screen shows it only in development or with
 * `?dev=metrics`, so the demo never shows it by default. Its numbers come from the recorder.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Switch } from 'react-router-dom';
import { AppServicesProvider, type AppContainer } from '../../src/ui/AppServices';
import { CheckIn } from '../../src/ui/screens/CheckIn';
import { DevMetricsOverlay } from '../../src/ui/dev/DevMetricsOverlay';
import { devMetricsVisible } from '../../src/ui/dev/devMetricsVisible';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FakeConnectivity } from '../../src/adapters/fakes/FakeConnectivity';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { createCheckinRunner } from '../../src/application/use-cases/runCheckin';
import { evaluateFromState } from '../../src/application/use-cases/evaluateFromState';
import { createDevMetricsRecorder, type DevMetricsRecorder } from '../../src/application/devMetrics';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { checkinScripts } from '../../src/config/checkinScripts';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import { t } from '../../src/config/messages.es';

/** Local 09:20 on the demo day, as in the check-in screen tests. */
const DEMO_NOW = new Date(2026, 10, 15, 9, 20);

beforeEach(() => {
  // jsdom has no WebGL: the body shows its fallback image, as in the other screen tests.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** A container for the check-in screen, built from fakes and the real runner. */
function buildContainer(devMetrics: DevMetricsRecorder): AppContainer {
  const voice = new FakeVoice({ mode: 'manual' });
  const clock = new FixedClock(DEMO_NOW);
  const agenda = new StaticAgenda(DEMO_AGENDA);
  const devices = new FakeDevices({});
  const repository = new MemoryCheckRepository();
  return {
    scenario: DEMO_SCENARIOS.normal,
    devices,
    repository,
    agenda,
    clock,
    connectivity: new FakeConnectivity(true),
    voiceMode: 'fake',
    recognizer: voice,
    synthesizer: voice,
    devMetrics,
    createCheckinRunner: () =>
      createCheckinRunner({
        recognizer: voice,
        synthesizer: voice,
        devices,
        agenda,
        clock,
        repository,
        evaluate: (state) => ({
          ...evaluateFromState(state, { at: clock.now().toISOString() }),
        }),
        script: checkinScripts.daily,
      }),
    storage: undefined,
  };
}

function renderCheckIn(container: AppContainer, path: string) {
  return render(
    <AppServicesProvider services={container}>
      <MemoryRouter initialEntries={[path]}>
        <Switch>
          <Route path="/checkin" component={CheckIn} />
        </Switch>
      </MemoryRouter>
    </AppServicesProvider>,
  );
}

describe('devMetricsVisible', () => {
  it('is off in the demo: no dev server and no ?dev=metrics', () => {
    expect(devMetricsVisible('', false)).toBe(false);
    expect(devMetricsVisible('?fake=voice', false)).toBe(false);
    expect(devMetricsVisible('?dev=other', false)).toBe(false);
  });

  it('is on with ?dev=metrics in any build, or always in the dev server', () => {
    expect(devMetricsVisible('?dev=metrics', false)).toBe(true);
    expect(devMetricsVisible('?fake=voice&dev=metrics', false)).toBe(true);
    expect(devMetricsVisible('', true)).toBe(true);
  });
});

describe('CheckIn dev metrics overlay', () => {
  it('is hidden by default, outside the dev server and without ?dev=metrics', () => {
    vi.stubEnv('DEV', false);
    renderCheckIn(buildContainer(createDevMetricsRecorder()), '/checkin');

    expect(screen.queryByLabelText(t('dev.title'))).toBeNull();
  });

  it('is shown with ?dev=metrics', async () => {
    vi.stubEnv('DEV', false);
    renderCheckIn(buildContainer(createDevMetricsRecorder()), '/checkin?dev=metrics');

    expect(await screen.findByLabelText(t('dev.title'))).toBeInTheDocument();
  });

  it('is hidden with ?dev=metrics when the container has no recorder', async () => {
    vi.stubEnv('DEV', false);
    const container = buildContainer(createDevMetricsRecorder());
    renderCheckIn({ ...container, devMetrics: undefined }, '/checkin?dev=metrics');

    expect(screen.queryByLabelText(t('dev.title'))).toBeNull();
  });
});

describe('DevMetricsOverlay', () => {
  it('shows the last run against the targets, and marks each one met or not', () => {
    const recorder = createDevMetricsRecorder();
    recorder.markStart(0);
    recorder.markPromptEnd(1_000);
    recorder.markListening(1_120); // 120 ms: within 300 ms
    recorder.markFinal(2_600, 1_900); // 700 ms: within 800 ms
    recorder.markSaved(41_200); // 41.2 s: within 60 s
    recorder.markFps(58); // within 30 fps

    render(<DevMetricsOverlay recorder={recorder} />);

    expect(screen.getByText('41,2 s')).toBeInTheDocument();
    expect(screen.getByText('120 ms')).toBeInTheDocument();
    expect(screen.getByText('700 ms')).toBeInTheDocument();
    expect(screen.getByText('58 fps')).toBeInTheDocument();
    expect(screen.getAllByText(t('dev.met'))).toHaveLength(4);
    expect(screen.queryByText(t('dev.notMet'))).toBeNull();
  });

  it('marks a run over the targets as not met, and an unmeasured metric as not measured', () => {
    const recorder = createDevMetricsRecorder();
    recorder.markStart(0);
    recorder.markSaved(75_000); // over 60 s
    recorder.markFps(20); // under 30 fps

    render(<DevMetricsOverlay recorder={recorder} />);

    expect(screen.getAllByText(t('dev.notMet'))).toHaveLength(2);
    // Voice start and final transcript are unmeasured: each shows "sin medir" as value and as verdict.
    expect(screen.getAllByText(t('dev.notMeasured'))).toHaveLength(4);
  });
});
