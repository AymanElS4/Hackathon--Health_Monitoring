/** History on mobile (< 768 px): 3 newest rows, "Show all" button, one row open at a time. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CheckRecord } from '@base-vital/contracts';
import { AppServicesProvider, type AppContainer } from '../../src/ui/AppServices';
import { History } from '../../src/ui/screens/History';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FakeConnectivity } from '../../src/adapters/fakes/FakeConnectivity';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import { t } from '../../src/config/messages.es';

function record(day: number): CheckRecord {
  const at = new Date(2026, 10, day, 9, 31).toISOString();
  return CheckRecord.parse({
    id: at,
    observations: [
      { indicator: 'sleep_hours', value: 7, source: 'voice', confirmed: true, simulated: false, at },
      { indicator: 'mood', value: 4, source: 'voice', confirmed: true, simulated: false, at },
    ],
    symptoms: ['none'],
    readings: Object.fromEntries(
      ['sleep', 'pulse', 'pressure', 'temperature', 'oxygen'].map((sensor) => [
        sensor,
        { sensor, level: 'green', phase: 'confirmed', value: '—', outsideNormal: false, teamCriterion: false, reason: null },
      ]),
    ),
    verdict: 'ok',
    actionKey: '',
    simulated: true,
  });
}

async function renderHistory(days: number) {
  const repository = new MemoryCheckRepository();
  const voice = new FakeVoice({ mode: 'manual' });
  const data = new Map<string, string>();
  const container: AppContainer = {
    scenario: DEMO_SCENARIOS.normal,
    devices: new FakeDevices({}),
    repository,
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock: new FixedClock(new Date(2026, 10, 20, 9, 40)),
    connectivity: new FakeConnectivity(true),
    voiceMode: 'fake',
    recognizer: voice,
    synthesizer: voice,
    createCheckinRunner: () => {
      throw new Error('unused');
    },
    storage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) },
  };
  for (let day = 1; day <= days; day += 1) await repository.save(record(day));
  return render(
    <AppServicesProvider services={container}>
      <MemoryRouter initialEntries={['/salud']}>
        <History />
      </MemoryRouter>
    </AppServicesProvider>,
  );
}

describe('History on mobile', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows 3 rows and a "show all" button that reveals the rest', async () => {
    await renderHistory(6);
    await waitFor(() => expect(screen.getAllByTestId('history-record')).toHaveLength(3));
    const button = screen.getByRole('button', { name: t('history.showAll', { n: 6 }) });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(screen.getAllByTestId('history-record')).toHaveLength(6);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('expands one row at a time to show values with source', async () => {
    await renderHistory(4);
    await waitFor(() => expect(screen.getAllByTestId('history-record')).toHaveLength(3));
    expect(screen.queryAllByText(t('history.source.voice'))).toHaveLength(0);
    const toggles = screen.getAllByRole('button').filter((b) => b.querySelector('time'));
    expect(toggles).toHaveLength(3);
    fireEvent.click(toggles[0]);
    expect(screen.getAllByText(t('history.source.voice'))).toHaveLength(2);
    expect(screen.getAllByText(`${t('value.mood', { value: 4 })}${t('team.criterion.mark')}`)).toHaveLength(1);
    fireEvent.click(toggles[1]);
    expect(screen.getAllByText(t('history.source.voice'))).toHaveLength(2);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
  });
});
