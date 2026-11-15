import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { messages } from '../../src/config/messages.es';
import { Home } from '../../src/ui/screens/Home';

describe('Home', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the mission dashboard and the deterministic CA4 preview', () => {
    render(
      <MemoryRouter>
        <Home
          scenarioId="ca4"
          repository={new MemoryCheckRepository()}
          onScenarioChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(messages['home.greeting'].replace('{name}', 'Ana'))).toBeInTheDocument();
    expect(screen.getByText('Hoy: Atención')).toBeInTheDocument();
    expect(screen.getAllByText('Sueño').length).toBeGreaterThan(0);
    expect(screen.getByText('5 h')).toBeInTheDocument();
    expect(screen.getByText(messages['home.metricNote'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages['home.start'] })).toHaveAttribute(
      'href',
      '/checkin',
    );
  });

  it('highlights a metric row when its body sensor is selected', () => {
    render(
      <MemoryRouter>
        <Home
          scenarioId="ca4"
          repository={new MemoryCheckRepository()}
          onScenarioChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver medida de Sueño: atención' }));

    expect(document.querySelector('.metric-row.is-selected')).toHaveTextContent('Sueño');
    expect(
      screen.getByRole('button', { name: 'Ver medida de Sueño: atención' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports the live offline state without changing the simulated readings', () => {
    render(
      <MemoryRouter>
        <Home
          scenarioId="normal"
          repository={new MemoryCheckRepository()}
          onScenarioChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText(messages['home.connectivity.offline'])).toBeInTheDocument();
    expect(screen.getByText('Hoy: Bien')).toBeInTheDocument();
  });

  it('labels the missing-pressure and low-temperature demo states', () => {
    const renderHome = (scenarioId: 'missing_sensor' | 'low_temp') =>
      render(
        <MemoryRouter>
          <Home
            scenarioId={scenarioId}
            repository={new MemoryCheckRepository()}
            onScenarioChange={vi.fn()}
          />
        </MemoryRouter>,
      );

    const missing = renderHome('missing_sensor');
    expect(
      screen.getByRole('button', { name: 'Ver medida de Presión: sin dato' }),
    ).toBeInTheDocument();
    missing.unmount();

    renderHome('low_temp');
    expect(
      screen.getByRole('button', { name: 'Ver medida de Temperatura: en duda' }),
    ).toBeInTheDocument();
  });
});
