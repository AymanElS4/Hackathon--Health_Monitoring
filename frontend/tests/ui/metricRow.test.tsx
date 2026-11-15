/**
 * Tests for the "Estado de Ana" building blocks (T072b): `MetricRow` (minimal: icon, name, value,
 * badge slot), `Legend`, and the `trailing` slot of `StatusHeader`. Phase 7 (T090) extends them.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MetricRow } from '../../src/ui/components/MetricRow';
import { Legend } from '../../src/ui/components/Legend';
import { StatusHeader } from '../../src/ui/components/StatusHeader';
import { Badge } from '../../src/ui/components/Badge';
import { messages, t } from '../../src/config/messages.es';

afterEach(() => {
  cleanup();
});

describe('MetricRow without a reading', () => {
  it('shows the sensor name and "—" as the value', () => {
    render(<MetricRow sensor="pressure" />);

    expect(screen.getByText(t('sensor.pressure'))).toBeInTheDocument();
    expect(screen.getByText(t('value.missing'))).toBeInTheDocument();
  });

  it('draws the icon in a 28 px circle tinted with the sensor color, not a level color', () => {
    const { container } = render(<MetricRow sensor="pulse" />);

    const circle = container.querySelector('li > span');
    expect(circle).toHaveClass('h-metricIcon', 'w-metricIcon', 'rounded-full', 'bg-sensor-pulse/15');
    expect(container.querySelector('svg')).toHaveClass('text-sensor-pulse');
  });

  it('has no badge', () => {
    render(<MetricRow sensor="sleep" />);

    expect(screen.queryByText(messages['level.green'])).toBeNull();
    expect(screen.queryByText(messages['status.verdict.ok'])).toBeNull();
    expect(document.querySelector('li .rounded-card')).toBeNull();
  });

  it('keeps the value in neutral ink, never a level color', () => {
    render(<MetricRow sensor="oxygen" />);

    const value = screen.getByText(t('value.missing'));
    expect(value).toHaveClass('text-ink');
    expect(value.className).not.toMatch(/text-level-/);
  });
});

describe('MetricRow with a reading', () => {
  it('shows the value, its unit and the badge in the slot', () => {
    render(
      <MetricRow
        sensor="temperature"
        value="36,8 °C"
        badge={<Badge level="green">{messages['status.verdict.ok']}</Badge>}
      />,
    );

    expect(screen.getByText('36,8 °C')).toBeInTheDocument();
    expect(screen.getByText(messages['status.verdict.ok'])).toBeInTheDocument();
    expect(screen.queryByText(t('value.missing'))).toBeNull();
  });

  it('shows a separate unit after the value when given', () => {
    render(<MetricRow sensor="pulse" value="72" unit="lpm" />);

    expect(screen.getByText('lpm')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
  });
});

describe('Legend', () => {
  it('lists allowed, attention, alert and the "tu normal" band, then the team criterion line', () => {
    const { container } = render(<Legend />);

    const items = within(container.querySelector('ul') as HTMLElement).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      messages['legend.allowed'],
      messages['legend.attention'],
      messages['legend.alert'],
      messages['legend.baseline'],
    ]);
    expect(screen.getByText(messages['team.criterion.note'])).toBeInTheDocument();
  });

  it('draws the keys with tokens: allowed zone, amber and red ring, baseline band', () => {
    const { container } = render(<Legend />);

    const keys = Array.from(container.querySelectorAll('li > span'));
    expect(keys[0]).toHaveClass('bg-range-allowed');
    expect(keys[1]).toHaveClass('bg-level-amber-ring');
    expect(keys[2]).toHaveClass('bg-level-red-ring');
    expect(keys[3]).toHaveClass('bg-baseline');
  });

  it('uses 13 px text', () => {
    const { container } = render(<Legend />);

    expect(container.firstElementChild).toHaveClass('text-meta');
  });
});

describe('StatusHeader trailing slot', () => {
  it('renders the trailing element at the right end of the title row', () => {
    render(
      <StatusHeader
        crewName="Ana"
        verdict="none"
        mood={null}
        trailing={<a href="/historial">{messages['home.history']}</a>}
      />,
    );

    const link = screen.getByRole('link', { name: messages['home.history'] });
    expect(link.parentElement).toHaveClass('ml-auto');
    expect(screen.getByText(t('status.noCheck'))).toBeInTheDocument();
  });

  it('renders no trailing wrapper when no trailing element is given', () => {
    const { container } = render(<StatusHeader crewName="Ana" verdict="none" mood={null} />);

    expect(container.querySelector('.ml-auto')).toBeNull();
  });
});
