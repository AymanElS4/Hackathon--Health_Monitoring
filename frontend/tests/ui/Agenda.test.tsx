import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { FakeConnectivity } from '../../src/adapters/fakes/FakeConnectivity';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import { messages } from '../../src/config/messages.es';
import { AppServicesProvider, type AppContainer } from '../../src/ui/AppServices';
import { Agenda } from '../../src/ui/screens/Agenda';

const DEMO_NOW = new Date(2026, 10, 15, 9, 20);

function buildContainer(): AppContainer {
  const voice = new FakeVoice({ mode: 'manual' });
  return {
    scenario: DEMO_SCENARIOS.normal,
    devices: new FakeDevices({}),
    repository: new MemoryCheckRepository(),
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock: new FixedClock(DEMO_NOW),
    connectivity: new FakeConnectivity(true),
    voiceMode: 'fake',
    recognizer: voice,
    synthesizer: voice,
    createCheckinRunner: () => {
      throw new Error('the check-in runner is not used by the Agenda tests');
    },
    storage: undefined,
  };
}

function renderAgenda() {
  return render(
    <AppServicesProvider services={buildContainer()}>
      <MemoryRouter initialEntries={['/agenda']}>
        <Route path="/agenda" component={Agenda} />
      </MemoryRouter>
    </AppServicesProvider>,
  );
}

describe('Agenda', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows today’s schedule from the same data used by Home’s “Después” list', () => {
    renderAgenda();

    expect(screen.getByRole('heading', { name: messages['screen.agenda'] })).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText('13:00')).toBeInTheDocument();
    expect(screen.getByText(messages['agenda.eva'])).toBeInTheDocument();
    expect(screen.getByText(messages['agenda.bioExperiment'])).toBeInTheDocument();
    expect(screen.getByText('5 actividades programadas')).toBeInTheDocument();

    const activeTab = screen.getByText(messages['nav.agenda'], { selector: 'span' }).closest('[aria-current]');
    expect(activeTab).toHaveAttribute('aria-current', 'page');
    expect(activeTab).toHaveClass('font-semibold', 'text-primary');
  });

  it('lets the user select dates and return to today’s schedule', () => {
    renderAgenda();

    fireEvent.click(screen.getByRole('button', { name: messages['calendar.nextMonth'] }));
    expect(screen.getByText(messages['calendar.empty'])).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: messages['calendar.today'] }));
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText('13:00')).toBeInTheDocument();
  });
});
