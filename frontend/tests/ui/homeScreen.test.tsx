/**
 * Tests for the Home screen container (T055, FR-013, RF1). The container is built by hand
 * from fakes; the screen only sees it through AppServicesProvider.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Switch, useLocation } from 'react-router-dom';
import { CheckRecord, SensorKey } from '@base-vital/contracts';
import { AppServicesProvider, type AppContainer } from '../../src/ui/AppServices';
import { Home } from '../../src/ui/screens/Home';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FakeConnectivity } from '../../src/adapters/fakes/FakeConnectivity';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import type { StorageLike } from '../../src/application/use-cases/selectDemoScenario';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import { messages, t } from '../../src/config/messages.es';
import { HISTORY_PATH } from '../../src/config/constants';

/** Local 09:20 on the demo day: "Chequeo diario" (09:30) is the current item. */
const DEMO_NOW = new Date(2026, 10, 15, 9, 20);

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
}

function buildContainer(
  connectivity: FakeConnectivity,
  voice: FakeVoice,
  repository: MemoryCheckRepository = new MemoryCheckRepository(),
): AppContainer {
  return {
    scenario: DEMO_SCENARIOS.normal,
    devices: new FakeDevices({}),
    repository,
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock: new FixedClock(DEMO_NOW),
    connectivity,
    voiceMode: 'fake',
    recognizer: voice,
    synthesizer: voice,
    createCheckinRunner: () => {
      throw new Error('the check-in runner is not used by the Home tests');
    },
    storage: memoryStorage(),
  };
}

/** Shows where the router landed, so the test can assert the navigation and its state. */
function CheckinProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}|${JSON.stringify(location.state ?? null)}`}</p>;
}

function renderHome(container: AppContainer) {
  return render(
    <AppServicesProvider services={container}>
      <MemoryRouter initialEntries={['/']}>
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/checkin" component={CheckinProbe} />
          <Route path="/agenda">
            <p data-testid="agenda-route">{messages['screen.agenda']}</p>
          </Route>
        </Switch>
      </MemoryRouter>
    </AppServicesProvider>,
  );
}

/** A valid check saved at 09:31 today with a confirmed voice mood, so Home shows a mood chip. */
function todayCheck(): CheckRecord {
  const savedAt = new Date(2026, 10, 15, 9, 31).toISOString();
  const readings = Object.fromEntries(
    ['sleep', 'pulse', 'pressure', 'temperature', 'oxygen'].map((sensor) => [
      sensor,
      { sensor, level: 'green', phase: 'confirmed', value: '—', outsideNormal: false, teamCriterion: false, reason: null },
    ]),
  );
  return CheckRecord.parse({
    id: savedAt,
    observations: [{ indicator: 'mood', value: 4, source: 'voice', confirmed: true, simulated: false, at: savedAt }],
    symptoms: ['none'],
    readings,
    verdict: 'ok',
    actionKey: '',
    simulated: false,
  });
}

describe('Home screen', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the criterion note exactly once when a check of today exists', async () => {
    const repository = new MemoryCheckRepository();
    await repository.save(todayCheck());
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }), repository);
    renderHome(container);

    await waitFor(() =>
      expect(screen.getByText(t('status.today', { verdict: t('status.verdict.ok') }))).toBeInTheDocument(),
    );
    expect(screen.getAllByText(messages['team.criterion.note'])).toHaveLength(1);
  });

  it('shows the criterion line once in the legend even without a check today (the legend always explains "*")', async () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(t('status.noCheck'))).toBeInTheDocument();
    expect(screen.getAllByText(messages['team.criterion.note'])).toHaveLength(1);
  });

  it('shows the greeting, the current activity, the next activities and the pending count', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(screen.getByRole('heading', { name: t('home.greeting', { name: 'Ana' }) })).toBeInTheDocument();
    expect(screen.getByText(t('home.now'))).toBeInTheDocument();
    expect(screen.getByText(messages['agenda.dailyCheckin'])).toBeInTheDocument();
    expect(screen.getByText(t('home.next'))).toBeInTheDocument();
    expect(screen.getByText(messages['agenda.eva'])).toBeInTheDocument();
    expect(screen.getByText(t('home.pending', { n: 5 }))).toBeInTheDocument();
  });

  it('shows 0 of 5 done and the check-in as current at 09:20 with no check', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(screen.getByText(t('home.progress', { done: 0, total: 5 }))).toBeInTheDocument();
  });

  it('shows the five metric rows in mockup order, each with "—" and no badge, when there is no check', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    const names = ['pressure', 'pulse', 'oxygen', 'temperature', 'sleep'].map((sensor) => t(`sensor.${sensor}`));
    const metricList = screen.getByText(names[0]).closest('ul') as HTMLElement;
    const items = within(metricList).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(names[index]);
      expect(within(item).getByText(t('value.missing'))).toBeInTheDocument();
      expect(within(item).queryByText(/^(Bien|Atención|Alerta)$/)).toBeNull();
    });
  });

  it('shows the legend at the bottom of "Estado de Ana"', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(screen.getByText(t('legend.allowed'))).toBeInTheDocument();
    expect(screen.getByText(t('legend.attention'))).toBeInTheDocument();
    expect(screen.getByText(t('legend.alert'))).toBeInTheDocument();
    expect(screen.getByText(t('legend.baseline'))).toBeInTheDocument();
    expect(screen.getByText(messages['team.criterion.note'])).toBeInTheDocument();
  });

  it('has no loose "Historial" link: the history is reached from "Ver historial →" and "Salud →" only', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(screen.queryByRole('link', { name: messages['history.link'] })).toBeNull();
    const historyLinks = screen.getAllByRole('link').filter((link) => link.getAttribute('href') === HISTORY_PATH);
    expect(historyLinks.map((link) => link.textContent)).toEqual([messages['nav.health'], messages['home.history']]);
  });

  it('"Ver historial →" sits in the "Estado de Ana" header and opens the history', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    const link = screen.getByRole('link', { name: messages['home.history'] });
    expect(link.closest('[class*="bg-canvas"]')).not.toBeNull();
    expect(link.closest('[class*="w-3/5"]')).not.toBeNull();
    expect(link).toHaveAttribute('href', HISTORY_PATH);
  });

  it('"Salud →" in the "Cómo estás" header is a link to the history while the Salud tab is disabled', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    const link = screen.getByRole('link', { name: new RegExp(messages['nav.health']) });
    expect(link).toHaveAttribute('href', HISTORY_PATH);
    expect(link).not.toHaveAttribute('aria-disabled');
  });

  it('renders the bottom navigation with Hoy as the current page', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    const hoy = screen.getByText(messages['nav.home']).closest('[aria-current]');
    expect(hoy).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the demo scenario selector out of the header', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(screen.getByLabelText(messages['scenario.title']).closest('header')).toBeNull();
  });

  it('has one Vita button, in the dock, and no full-width Vita button', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    const vitaButtons = screen.getAllByRole('button', { name: messages['home.vita'] });
    expect(vitaButtons).toHaveLength(1);
    expect(vitaButtons[0].closest('nav')).not.toBeNull();
    expect(vitaButtons[0].className).not.toMatch(/w-full/);
  });

  it('places the "Ahora" and "Después" cards in the 4-column region and "Cómo estás" in the 8-column region', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(screen.getByText(t('home.now')).closest('[class*="col-span-4"]')).not.toBeNull();
    expect(screen.getByText(t('home.next')).closest('[class*="col-span-4"]')).not.toBeNull();
    const howAreYou = screen.getByText(t('home.howAreYou')).closest('[class*="col-span-8"]');
    expect(howAreYou).not.toBeNull();
    expect(within(howAreYou as HTMLElement).getByText(t('status.noCheck'))).toBeInTheDocument();
  });

  it('opens the agenda from the "Después" card and bottom navigation', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    const links = screen.getAllByRole('link', { name: messages['nav.agenda'] });
    expect(links).toHaveLength(2);
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', '/agenda');
      expect(link).not.toHaveAttribute('aria-disabled');
      expect(link).not.toHaveAttribute('title', messages['nav.soon']);
    });

    fireEvent.click(links[0]);
    expect(screen.getByTestId('agenda-route')).toHaveTextContent(messages['screen.agenda']);
  });

  it('shows the "Empezar" pill inside the "Ahora" footer, not full width', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    const start = screen.getByRole('button', { name: messages['home.start'] });
    expect(start).toHaveClass('rounded-full');
    expect(start.className).not.toMatch(/w-full/);
    expect(screen.getByText(t('home.estimated', { min: 1 }))).toBeInTheDocument();
  });

  it('renders the demo scenario selector', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(screen.getByLabelText(messages['scenario.title'])).toBeInTheDocument();
  });

  it('clicking "Empezar" navigates to /checkin with the autostart state', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    fireEvent.click(screen.getByRole('button', { name: messages['home.start'] }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/checkin|${JSON.stringify({ autostart: true })}`,
    );
  });

  it('the dock "Vita" button starts the check-in with the autostart state', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    fireEvent.click(screen.getByRole('button', { name: messages['home.vita'] }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/checkin|${JSON.stringify({ autostart: true })}`,
    );
  });

  it('calls recognizer.preload on mount and ignores its failure', () => {
    const voice = new FakeVoice({ mode: 'manual' });
    const preload = vi.spyOn(voice, 'preload').mockRejectedValue(new Error('model missing'));
    const container = buildContainer(new FakeConnectivity(true), voice);

    expect(() => renderHome(container)).not.toThrow();
    expect(preload).toHaveBeenCalledTimes(1);
    expect(screen.getByText(messages['home.now'])).toBeInTheDocument();
  });

  it('updates the connectivity text when the connectivity changes', () => {
    const connectivity = new FakeConnectivity(true);
    const container = buildContainer(connectivity, new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(screen.getByText(messages['connectivity.online'])).toBeInTheDocument();

    act(() => {
      connectivity.setOnline(false);
    });

    expect(screen.getByText(messages['connectivity.offline'])).toBeInTheDocument();
    expect(screen.queryByText(messages['connectivity.online'])).not.toBeInTheDocument();
  });
});

// jsdom has no WebGL: the body shows its fallback image and dots (CL5).
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A check of today in which one sensor has no reading (all others green). */
function todayCheckWithout(missing: SensorKey): CheckRecord {
  const savedAt = new Date(2026, 10, 15, 9, 31).toISOString();
  const sensors = SensorKey.options.filter((sensor) => sensor !== missing);
  const readings = Object.fromEntries(
    sensors.map((sensor) => [
      sensor,
      { sensor, level: 'green', phase: 'confirmed', value: '—', outsideNormal: false, teamCriterion: false, reason: null },
    ]),
  );
  return CheckRecord.parse({
    id: savedAt,
    observations: [],
    symptoms: ['none'],
    readings,
    verdict: 'ok',
    actionKey: '',
    simulated: false,
  });
}

/** A check of today with no mood observation: only the sleep dot is altered and carries the mark. */
function sleepMarkedCheck(): CheckRecord {
  const savedAt = new Date(2026, 10, 15, 9, 31).toISOString();
  const readings = Object.fromEntries(
    ['sleep', 'pulse', 'pressure', 'temperature', 'oxygen'].map((sensor) => [
      sensor,
      sensor === 'sleep'
        ? { sensor, level: 'amber', phase: 'confirmed', value: '5 h', outsideNormal: false, teamCriterion: true, reason: 'mood' }
        : { sensor, level: 'green', phase: 'confirmed', value: '—', outsideNormal: false, teamCriterion: false, reason: null },
    ]),
  );
  return CheckRecord.parse({
    id: savedAt,
    observations: [],
    symptoms: ['none'],
    readings,
    verdict: 'attention',
    actionKey: 'action.slept_little',
    simulated: false,
  });
}

describe('Home body area', () => {
  it('renders the body area with the fallback image and five sensor dots, no focus yet', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(screen.getByRole('img', { name: t('body.fallbackAlt') })).toBeInTheDocument();
    expect(document.querySelectorAll('button[data-sensor]')).toHaveLength(5);
    expect(document.querySelector('.sensor-dot__halo')).toBeNull();
    expect(screen.getByText(t('body.tapSensor'))).toBeInTheDocument();
  });

  it('tapping a dot sets it as the focus: the halo shows on that dot only', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t('sensor.pulse')}`) }));

    expect(document.querySelector('button[data-sensor="pulse"] .sensor-dot__halo')).not.toBeNull();
    expect(document.querySelectorAll('.sensor-dot__halo')).toHaveLength(1);
  });

  it('without a check today the dots are identity dots: no "sin dato" anywhere on the body', () => {
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }));
    renderHome(container);

    expect(document.querySelectorAll('[data-level]')).toHaveLength(0);
    expect(screen.queryByText(t('level.unknown'))).not.toBeInTheDocument();
  });

  it('with a check today, a sensor with no reading shows "sin dato"', async () => {
    const repository = new MemoryCheckRepository();
    await repository.save(todayCheckWithout('pressure'));
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }), repository);
    renderHome(container);

    await waitFor(() =>
      expect(document.querySelector('[data-sensor="pressure"]')).toHaveAttribute('data-level', 'unknown'),
    );
    expect(screen.getByText(t('level.unknown'))).toBeInTheDocument();
    expect(document.querySelector('[data-sensor="pulse"]')).toHaveAttribute('data-level', 'green');
  });

  it('shows the team-criterion note exactly once when only a dot carries the mark', async () => {
    const repository = new MemoryCheckRepository();
    await repository.save(sleepMarkedCheck());
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }), repository);
    renderHome(container);

    await waitFor(() =>
      expect(screen.getByText(t('status.today', { verdict: t('status.verdict.attention') }))).toBeInTheDocument(),
    );
    expect(screen.getAllByText(messages['team.criterion.note'])).toHaveLength(1);
  });
});


describe('Home "Estado de Ana" rows with a check today', () => {
  it('shows each reading with its level badge, and "—" with no badge for a sensor without a reading', async () => {
    const repository = new MemoryCheckRepository();
    await repository.save(todayCheckWithout('pressure'));
    const container = buildContainer(new FakeConnectivity(true), new FakeVoice({ mode: 'manual' }), repository);
    renderHome(container);

    await waitFor(() => expect(screen.getByText(t('status.today', { verdict: t('status.verdict.ok') }))).toBeInTheDocument());
    const rowOf = (name: string) =>
      screen
        .getAllByText(name)
        .map((element) => element.closest('li'))
        .find((item): item is HTMLLIElement => item !== null && item.closest('ul') !== null && item.querySelector('p') !== null) as HTMLElement;
    const pressureRow = rowOf(t('sensor.pressure'));
    expect(within(pressureRow).getByText(t('value.missing'))).toBeInTheDocument();
    expect(within(pressureRow).queryByText(t('status.verdict.ok'))).toBeNull();

    const pulseRow = rowOf(t('sensor.pulse'));
    expect(within(pulseRow).getByText(t('status.verdict.ok'))).toBeInTheDocument();
  });
});
