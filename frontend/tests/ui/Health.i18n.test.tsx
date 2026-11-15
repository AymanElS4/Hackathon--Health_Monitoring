/** Health dashboard i18n: renders in es and en, and the two catalogs have the same keys. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { PhysiologicalMetricsDashboard } from '../../src/ui/components/PhysiologicalMetricsDashboard';
import { HEALTH_ES } from '../../src/config/catalogs/health.es';
import { HEALTH_EN } from '../../src/config/catalogs/health.en';
import { setLocale, resetLocaleCache } from '../../src/config/i18n';

// Recharts needs real layout sizes; jsdom has none, so the chart library is replaced by stubs.
vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: unknown }) => <div>{children as never}</div>;
  return {
    ResponsiveContainer: Stub,
    LineChart: Stub,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetLocaleCache();
});

describe('Health dashboard i18n', () => {
  it('has the same keys in HEALTH_ES and HEALTH_EN', () => {
    expect(Object.keys(HEALTH_EN).sort()).toEqual(Object.keys(HEALTH_ES).sort());
    expect(Object.keys(HEALTH_ES).every((k) => k.startsWith('health.'))).toBe(true);
  });

  it('renders in Spanish', async () => {
    setLocale('es');
    render(<PhysiologicalMetricsDashboard />);
    await waitFor(() => expect(screen.getByText('Modo Demostración (Fallback)')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Todas las métricas' })).toBeTruthy();
    expect(screen.getAllByText('Horas de Sueño').length).toBeGreaterThan(0);
  });

  it('renders in English', async () => {
    setLocale('en');
    render(<PhysiologicalMetricsDashboard />);
    await waitFor(() => expect(screen.getByText('Demo mode (fallback)')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'All metrics' })).toBeTruthy();
    expect(screen.getAllByText('Hours of Sleep').length).toBeGreaterThan(0);
    expect(screen.queryByText('Todas las métricas')).toBeNull();
  });
});
