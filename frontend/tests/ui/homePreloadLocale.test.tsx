/**
 * Home re-runs the voice model preload when the UI locale changes (006 review finding 4):
 * the model of the language in use must follow the toggle on Home, not the first locale read.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppServicesProvider, type AppContainer } from '../../src/ui/AppServices';
import { Home } from '../../src/ui/screens/Home';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FakeConnectivity } from '../../src/adapters/fakes/FakeConnectivity';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import { setLocale } from '../../src/config/i18n';

afterEach(() => {
  cleanup();
});

function containerWithPreload(preload: () => Promise<void>): AppContainer {
  const voice = new FakeVoice({ mode: 'manual' });
  voice.preload = preload;
  return {
    scenario: DEMO_SCENARIOS.normal,
    devices: new FakeDevices({}),
    repository: new MemoryCheckRepository(),
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock: new FixedClock(new Date(2026, 10, 15, 9, 20)),
    connectivity: new FakeConnectivity(true),
    voiceMode: 'fake',
    recognizer: voice,
    synthesizer: voice,
    createCheckinRunner: () => {
      throw new Error('the check-in runner is not used by this test');
    },
    storage: undefined,
  };
}

describe('Home voice preload follows the UI locale', () => {
  it('preloads again when the locale changes', () => {
    const preload = vi.fn(() => Promise.resolve());
    const services = containerWithPreload(preload);
    render(
      <MemoryRouter>
        <AppServicesProvider services={services}>
          <Home />
        </AppServicesProvider>
      </MemoryRouter>,
    );
    expect(preload).toHaveBeenCalledTimes(1);

    act(() => {
      setLocale('en');
    });

    expect(preload).toHaveBeenCalledTimes(2);
  });
});
