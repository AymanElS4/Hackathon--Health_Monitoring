/**
 * Tests for the metric rows with range bars (T091): `MetricRows` renders the rows of
 * `metricReadingsOf` in METRIC_ORDER, places each marker on its value (SC-013, CA4), highlights the
 * focused sensor (FR-017), reports a tapped row, and shows "Aún aprendo tu normal" while the baseline
 * is not ready (CL3).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { CheckRecord, SensorKey } from '@base-vital/contracts';
import { MetricRows } from '../../src/ui/components/MetricRows';
import { metricReadingsOf, type StatusReading } from '../../src/application/use-cases/metricReadings';
import { METRIC_ORDER } from '../../src/config/constants';
import { t } from '../../src/config/messages.es';
import { ca4Check } from './ca4Check';

afterEach(() => {
  cleanup();
});

/** The metric rows of one check, as Home and the check-in build them. */
function rowsOf(record: CheckRecord, previousChecks: CheckRecord[] = []): StatusReading[] {
  return metricReadingsOf({ readings: Object.values(record.readings), observations: record.observations, previousChecks });
}

/** The `li` row of a sensor, found by its name. */
function rowFor(sensor: SensorKey): HTMLElement {
  const row = Array.from(document.querySelectorAll<HTMLElement>('li[data-highlighted]')).find((item) =>
    item.textContent?.includes(t(`sensor.${sensor}`)),
  );
  if (row === undefined) throw new Error(`no row for ${sensor}`);
  return row;
}

/** Left position of a marker in percent, from its inline style. */
function leftPct(element: HTMLElement): number {
  return parseFloat(element.style.left);
}

describe('MetricRows order and content', () => {
  it('renders one row per sensor in METRIC_ORDER', () => {
    render(<MetricRows readings={rowsOf(ca4Check())} focus={null} />);

    const rows = document.querySelectorAll('li[data-highlighted]');
    expect(rows).toHaveLength(METRIC_ORDER.length);
    METRIC_ORDER.forEach((sensor, index) => {
      expect(rows[index].textContent).toContain(t(`sensor.${sensor}`));
    });
  });

  it('shows "—" with no bar for a sensor that has no reading', () => {
    render(<MetricRows readings={[]} focus={null} />);

    expect(screen.getAllByText(t('value.missing'))).toHaveLength(METRIC_ORDER.length);
    expect(document.querySelector('[data-testid="range-bar"]')).toBeNull();
  });

  it('shows the allowed range centred under the bar, e.g. "Permitido ≥ 7 h" for sleep', () => {
    render(<MetricRows readings={rowsOf(ca4Check())} focus={null} />);

    expect(within(rowFor('sleep')).getByTestId('range-allowed')).toHaveTextContent(t('allowed.shown', { range: '≥ 7 h' }));
    expect(within(rowFor('pressure')).getByTestId('range-allowed')).toHaveTextContent(t('allowed.shown', { range: '< 120/80' }));
  });
});

describe('MetricRows range bars at CA4 (SC-013, SC-011)', () => {
  it('places the sleep marker on 5 h of 0–10 h: 50 %', () => {
    render(<MetricRows readings={rowsOf(ca4Check())} focus={null} />);

    const marker = within(rowFor('sleep')).getByTestId('range-marker');
    expect(leftPct(marker)).toBeCloseTo(50);
  });

  it('draws the sleep bar with its amber zone first, then the allowed zone', () => {
    render(<MetricRows readings={rowsOf(ca4Check())} focus={null} />);

    const zones = within(rowFor('sleep')).getAllByTestId('range-zone');
    expect(zones.map((zone) => zone.getAttribute('data-level'))).toEqual(['amber', 'green']);
  });

  it('places the blood pressure marker on 118 mmHg of 90–160: 40 %', () => {
    render(<MetricRows readings={rowsOf(ca4Check())} focus={null} />);

    const bubble = within(rowFor('pressure')).getByTestId('range-bubble');
    expect(bubble).toHaveTextContent('118/76 mmHg');
    expect(leftPct(within(rowFor('pressure')).getByTestId('range-marker'))).toBeCloseTo(40);
  });

  it('shows the value of the check in the bubble above the pulse marker', () => {
    render(<MetricRows readings={rowsOf(ca4Check())} focus={null} />);

    expect(within(rowFor('pulse')).getByTestId('range-bubble')).toHaveTextContent('72 lpm');
  });
});

describe('MetricRows highlight and tap (FR-017, SC-012)', () => {
  it('highlights only the row of the focused sensor', () => {
    render(<MetricRows readings={rowsOf(ca4Check())} focus="pulse" />);

    expect(rowFor('pulse')).toHaveAttribute('data-highlighted', 'true');
    expect(rowFor('sleep')).toHaveAttribute('data-highlighted', 'false');
    expect(document.querySelectorAll('li[data-highlighted="true"]')).toHaveLength(1);
  });

  it('calls onSelect with the sensor of the tapped row', () => {
    const selected: SensorKey[] = [];
    render(<MetricRows readings={rowsOf(ca4Check())} focus={null} onSelect={(sensor) => selected.push(sensor)} />);

    fireEvent.click(rowFor('oxygen'));

    expect(selected).toEqual(['oxygen']);
  });

  it('is not tappable without a handler: no pointer cursor on the check-in rows', () => {
    render(<MetricRows readings={rowsOf(ca4Check())} focus={null} />);

    expect(rowFor('oxygen').className).not.toContain('cursor-pointer');
  });
});

describe('MetricRows outside normal (RN3, Principle VIII)', () => {
  it('shows the pulse row as "Atención*" when the value is outside the personal normal', () => {
    const record = ca4Check();
    const pulse = record.readings.pulse;
    if (pulse === undefined) throw new Error('fixture has no pulse reading');
    const outside: CheckRecord = {
      ...record,
      readings: {
        ...record.readings,
        pulse: { ...pulse, level: 'amber', teamCriterion: true, reason: 'resting_heart_rate' },
      },
    };
    render(<MetricRows readings={rowsOf(outside)} focus={null} />);

    expect(rowFor('pulse').textContent).toContain(`${t('status.verdict.attention')}${t('team.criterion.mark')}`);
  });
});

describe('MetricRows "tu normal" (CL3, RN3)', () => {
  it('shows "Aún aprendo tu normal" on every row with a bar while there are fewer than 14 days', () => {
    render(<MetricRows readings={rowsOf(ca4Check())} focus={null} />);

    expect(screen.getAllByText(t('baseline.learning'))).toHaveLength(METRIC_ORDER.length);
    expect(document.querySelector('[data-testid="range-baseline"]')).toBeNull();
  });

  it('draws the "tu normal" band and no learning text once the baseline is ready', () => {
    const previous = Array.from({ length: 14 }, (_, index) => dayCheckWithPulse(14 - index, 62));
    render(<MetricRows readings={rowsOf(ca4Check(), previous)} focus={null} />);

    expect(screen.queryByText(t('baseline.learning'))).toBeNull();
    expect(within(rowFor('pulse')).getByTestId('range-baseline')).toBeInTheDocument();
  });
});

/** A previous day with only a pulse observation, for the baseline. */
function dayCheckWithPulse(day: number, pulse: number): CheckRecord {
  const base = ca4Check(new Date(2026, 10, day, 9, 31).toISOString());
  return { ...base, observations: base.observations.map((o) => (o.indicator === 'resting_heart_rate' ? { ...o, value: pulse } : o)) };
}
