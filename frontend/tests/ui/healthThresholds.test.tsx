/** Health panel thresholds: every reference line comes from THRESHOLDS (health-rules), team bands are marked. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { THRESHOLDS, FEVER_MIN_CELSIUS } from '@base-vital/health-rules';
import { PhysiologicalMetricsDashboard } from '../../src/ui/components/PhysiologicalMetricsDashboard';
import { setLocale, resetLocaleCache } from '../../src/config/i18n';

// ReferenceLine renders its y and label as text so the lines can be inspected; other chart parts are stubs.
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
    ReferenceLine: ({ y, label }: { y: number; label: { value: string } }) => (
      <div data-testid="refline" data-y={y}>
        {label.value}
      </div>
    ),
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

async function renderPanel(locale: 'es' | 'en') {
  setLocale(locale);
  render(<PhysiologicalMetricsDashboard />);
  await waitFor(() => expect(screen.getAllByTestId('refline').length).toBeGreaterThan(0));
}

describe('Health panel thresholds', () => {
  it('draws the fever line at the CDC threshold from THRESHOLDS, not at 37.2', async () => {
    await renderPanel('es');
    const fever = THRESHOLDS.find((th) => th.indicator === 'body_temperature' && th.red.min !== undefined);
    expect(fever?.red.min).toBe(FEVER_MIN_CELSIUS);
    const lines = screen.getAllByTestId('refline');
    const feverLine = lines.find((el) => /Fiebre/.test(el.textContent ?? ''));
    expect(feverLine?.getAttribute('data-y')).toBe(String(fever?.red.min));
    expect(feverLine?.textContent).toBe('Fiebre ≥ 38,0 °C');
    expect(lines.some((el) => /37,2/.test(el.textContent ?? ''))).toBe(false);
    expect(screen.getAllByText(/Fuente: .*CDC/).length).toBeGreaterThan(0);
  });

  it('labels the fever line in English', async () => {
    await renderPanel('en');
    expect(screen.getByText('Fever ≥ 38.0 °C')).toBeTruthy();
  });

  it('shows the team-criterion note once, with "*" on team bands', async () => {
    await renderPanel('es');
    expect(screen.getAllByText('* criterio del equipo, no clínico')).toHaveLength(1);
    expect(screen.getByText('Rojo ≥ 111*')).toBeTruthy();
  });

  it('shows no team note when only cited bands are drawn', async () => {
    await renderPanel('es');
    fireEvent.click(screen.getByRole('button', { name: 'Temperatura Corporal' }));
    expect(screen.queryByText('* criterio del equipo, no clínico')).toBeNull();
  });

  it('does not call the thresholds "clínicos"', async () => {
    await renderPanel('es');
    expect(document.body.textContent).not.toMatch(/umbrales clínicos|gráficos clínicos|Referencia Clínica/);
  });
});
