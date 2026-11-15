/** Health panel responsive behavior: one metric at a time on mobile, all metrics on desktop. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PhysiologicalMetricsDashboard } from '../../src/ui/components/PhysiologicalMetricsDashboard';
import { setLocale, resetLocaleCache } from '../../src/config/i18n';
import { t } from '../../src/config/messages.es';

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: unknown }) => <div data-testid="chart">{children as never}</div>;
  const Nothing = () => null;
  return {
    ResponsiveContainer: Stub,
    LineChart: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
    Line: Nothing,
    XAxis: Nothing,
    YAxis: Nothing,
    CartesianGrid: Nothing,
    Tooltip: Nothing,
    Legend: Nothing,
    ReferenceLine: Nothing,
  };
});

/** Stubs `matchMedia` so the desktop query answers `desktop`. */
function stubViewport(desktop: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: desktop,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  setLocale('es');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetLocaleCache();
});

describe('Health panel on mobile', () => {
  it('shows one chart and switches metric with the chips', async () => {
    stubViewport(false);
    render(<PhysiologicalMetricsDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('chart')).toHaveLength(1));

    expect(screen.queryByRole('button', { name: t('health.filter.all') })).toBeNull();
    expect(screen.getByRole('button', { name: t('health.chip.sleep') }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(t('health.metric.sleep.title'));

    fireEvent.click(screen.getByRole('button', { name: t('health.chip.heart') }));
    expect(screen.getAllByTestId('chart')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(t('health.metric.heart.title'));
  });

  it('shows the latest value level badge and a more-info toggle', async () => {
    stubViewport(false);
    render(<PhysiologicalMetricsDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('chart')).toHaveLength(1));

    expect(screen.getByText(t('status.verdict.ok'))).toBeTruthy();
    const toggle = screen.getByRole('button', { name: t('health.info.show') });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: t('health.info.hide') }).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Health panel on desktop', () => {
  it('keeps the all-metrics view with four charts and no badge', async () => {
    stubViewport(true);
    render(<PhysiologicalMetricsDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('chart')).toHaveLength(4));

    expect(screen.getByRole('button', { name: t('health.filter.all') })).toBeTruthy();
    expect(screen.queryByText(t('status.verdict.ok'))).toBeNull();
  });
});
