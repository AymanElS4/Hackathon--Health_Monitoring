/**
 * Tests for the "Estado de Ana" metric rows and their range bar (T084, docs/design/README.md
 * "Metric row" and "Legend", D3, D15, D16, D32).
 *
 * Layouts are hand-built here in the `computeRangeBar` return shape (T083 contract), so the
 * RangeBar is tested without the layout module. `MetricRow` keeps its T072b behaviour and adds:
 * `level` (Badge with the level text), `teamCriterion` (Badge mark), `source` and `simulated`
 * (device note), `highlighted`, `layout` (RangeBar under the line) and `baselineLearning`.
 *
 * `RangeBar` props: `layout` (RangeBarLayout), `valueLabel` (formatted value for the bubble),
 * `baselineLearning` (true → "Aún aprendo tu normal" in place of the band).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Level } from '@base-vital/contracts';
import type { RangeBarLayout } from '../../src/ui/components/rangeBarLayout';
import { MetricRow } from '../../src/ui/components/MetricRow';
import { RangeBar } from '../../src/ui/components/RangeBar';
import { Legend } from '../../src/ui/components/Legend';
import { messages, t } from '../../src/config/messages.es';

afterEach(() => {
  cleanup();
});

/** Pulse scale [40, 130] (UI_SCALES). Percent of the scale, as `computeRangeBar` returns it. */
const pulsePct = (value: number) => ((value - 40) / 90) * 100;
const pulseLayout: RangeBarLayout = {
  zones: [
    { level: 'amber', fromPct: 0, toPct: pulsePct(60) },
    { level: 'green', fromPct: pulsePct(60), toPct: pulsePct(101) },
    { level: 'amber', fromPct: pulsePct(101), toPct: pulsePct(111) },
    { level: 'red', fromPct: pulsePct(111), toPct: 100 },
  ],
  markerPct: pulsePct(72),
  baselinePct: { from: pulsePct(62), to: pulsePct(82) },
  cuts: [
    { pct: pulsePct(60), value: 60 },
    { pct: pulsePct(101), value: 101 },
    { pct: pulsePct(111), value: 111 },
  ],
};

/** Temperature scale [35, 39]: in_doubt below 36.1, green, amber, red from 38. */
const tempPct = (value: number) => ((value - 35) / 4) * 100;
const tempLayout: RangeBarLayout = {
  zones: [
    { level: 'in_doubt', fromPct: 0, toPct: tempPct(36.1) },
    { level: 'green', fromPct: tempPct(36.1), toPct: tempPct(37.3) },
    { level: 'amber', fromPct: tempPct(37.3), toPct: tempPct(38) },
    { level: 'red', fromPct: tempPct(38), toPct: 100 },
  ],
  markerPct: tempPct(36.8),
  baselinePct: null,
  cuts: [
    { pct: tempPct(36.1), value: 36.1 },
    { pct: tempPct(37.3), value: 37.3 },
    { pct: tempPct(38), value: 38 },
  ],
};

/** Reads a numeric inline style (left, width, flex-grow) as written by React. */
const styleNumber = (element: HTMLElement, property: string) => parseFloat(element.style.getPropertyValue(property));

describe('MetricRow (T072b behaviour kept)', () => {
  it('shows the sensor label and the value in neutral ink with its unit', () => {
    render(<MetricRow sensor="pulse" value="72" unit="lpm" />);

    expect(screen.getByText(t('sensor.pulse'))).toBeInTheDocument();
    const value = screen.getByText('72');
    expect(value.closest('p')).toHaveClass('text-ink');
    expect(value.closest('p')?.className).not.toMatch(/text-level-/);
    expect(screen.getByText('lpm')).toBeInTheDocument();
  });

  it('keeps the badge slot', () => {
    render(<MetricRow sensor="pulse" value="72" badge={<span>slot</span>} />);

    expect(screen.getByText('slot')).toBeInTheDocument();
  });
});

describe('MetricRow badge and team criterion', () => {
  it('shows a Badge with the level text and its level marker', () => {
    render(<MetricRow sensor="pressure" value="118" level="amber" />);

    expect(screen.getByText(messages['status.verdict.attention'])).toBeInTheDocument();
    expect(screen.getByTestId('badge-level-marker')).toBeInTheDocument();
  });

  it('shows a green Badge without a level marker', () => {
    render(<MetricRow sensor="oxygen" value="98" level="green" />);

    expect(screen.getByText(messages['status.verdict.ok'])).toBeInTheDocument();
    expect(screen.queryByTestId('badge-level-marker')).toBeNull();
  });

  it('adds the team-criterion mark to the badge when teamCriterion is set', () => {
    render(<MetricRow sensor="sleep" value="5 h" level="amber" teamCriterion />);

    expect(screen.getByText(t('team.criterion.mark'))).toBeInTheDocument();
  });

  it('has no badge without a level', () => {
    render(<MetricRow sensor="sleep" value="7 h" />);

    expect(screen.queryByTestId('badge-level-marker')).toBeNull();
    expect(screen.queryByText(messages['status.verdict.ok'])).toBeNull();
  });
});

describe('MetricRow device note', () => {
  it('shows "equipo simulado" for a simulated device value', () => {
    render(<MetricRow sensor="pulse" value="72" unit="lpm" source="device" simulated />);

    expect(screen.getByText(messages['device.simulated'])).toBeInTheDocument();
  });

  it('shows no device note for a voice value', () => {
    render(<MetricRow sensor="sleep" value="7 h" source="voice" />);

    expect(screen.queryByText(messages['device.simulated'])).toBeNull();
  });
});

describe('MetricRow highlight', () => {
  it('marks the row with data-highlighted="true" and a primary ring when highlighted', () => {
    const { container } = render(<MetricRow sensor="temperature" highlighted />);

    const row = container.querySelector('li');
    expect(row).toHaveAttribute('data-highlighted', 'true');
    expect(row).toHaveClass('ring-2', 'ring-primary');
  });

  it('is not highlighted by default', () => {
    const { container } = render(<MetricRow sensor="temperature" />);

    expect(container.querySelector('li')).toHaveAttribute('data-highlighted', 'false');
  });
});

describe('MetricRow range bar', () => {
  it('renders the RangeBar under the line when a layout is given', () => {
    const { container } = render(<MetricRow sensor="pulse" value="72" unit="lpm" layout={pulseLayout} />);

    expect(screen.getByTestId('range-bar')).toBeInTheDocument();
    expect(container.querySelector('li')).toContainElement(screen.getByTestId('range-bar'));
  });

  it('renders no RangeBar without a layout', () => {
    render(<MetricRow sensor="pulse" value="72" unit="lpm" />);

    expect(screen.queryByTestId('range-bar')).toBeNull();
  });

  it('shows the value with its unit in the bubble', () => {
    render(<MetricRow sensor="pulse" value="72" unit="lpm" layout={pulseLayout} />);

    expect(screen.getByTestId('range-bubble')).toHaveTextContent('72 lpm');
  });

  it('passes baselineLearning to the RangeBar', () => {
    render(
      <MetricRow
        sensor="pulse"
        value="72"
        layout={{ ...pulseLayout, baselinePct: null }}
        baselineLearning
      />,
    );

    expect(screen.getByText(messages['baseline.learning'])).toBeInTheDocument();
  });
});

describe('RangeBar zones', () => {
  it('renders one zone per layout zone, in order, with its level', () => {
    render(<RangeBar layout={pulseLayout} valueLabel="72 lpm" />);

    const zones = screen.getAllByTestId('range-zone');
    expect(zones.map((zone) => zone.getAttribute('data-level'))).toEqual(['amber', 'green', 'amber', 'red']);
  });

  it.each<[Level, string]>([
    ['green', 'bg-range-allowed'],
    ['amber', 'bg-level-amber-ring'],
    ['red', 'bg-level-red-ring'],
    ['in_doubt', 'bg-level-in_doubt-ring'],
    ['unknown', 'bg-level-unknown-fill'],
  ])('colors a %s zone with the token class %s', (level, className) => {
    const layout: RangeBarLayout = {
      zones: [{ level, fromPct: 0, toPct: 100 }],
      markerPct: null,
      baselinePct: null,
      cuts: [],
    };
    render(<RangeBar layout={layout} valueLabel="" />);

    expect(screen.getByTestId('range-zone')).toHaveClass(className);
  });

  it('uses the allowed-zone token (#4A90E2) for the green zone', () => {
    render(<RangeBar layout={pulseLayout} valueLabel="72 lpm" />);

    const green = screen.getAllByTestId('range-zone').find((zone) => zone.getAttribute('data-level') === 'green');
    expect(green).toHaveClass('bg-range-allowed');
  });

  it('sizes each zone by its percent of the scale', () => {
    render(<RangeBar layout={pulseLayout} valueLabel="72 lpm" />);

    const zones = screen.getAllByTestId('range-zone');
    pulseLayout.zones.forEach((zone, index) => {
      expect(styleNumber(zones[index], 'flex-grow')).toBeCloseTo(zone.toPct - zone.fromPct, 5);
    });
  });

  it('leaves 2 px white gaps between zones', () => {
    render(<RangeBar layout={pulseLayout} valueLabel="72 lpm" />);

    expect(screen.getByTestId('range-zones')).toHaveClass('gap-[2px]');
  });
});

describe('RangeBar marker and value bubble', () => {
  it('places the marker dot at markerPct', () => {
    render(<RangeBar layout={pulseLayout} valueLabel="72 lpm" />);

    expect(styleNumber(screen.getByTestId('range-marker'), 'left')).toBeCloseTo(pulsePct(72), 5);
  });

  it('shows the formatted value in a dark navy bubble with white text, above the marker', () => {
    render(<RangeBar layout={pulseLayout} valueLabel="72 lpm" />);

    const bubble = screen.getByTestId('range-bubble');
    expect(bubble).toHaveTextContent('72 lpm');
    expect(bubble).toHaveClass('bg-ink', 'text-white');
    expect(styleNumber(bubble, 'left')).toBeCloseTo(pulsePct(72), 5);
  });

  it('shows no marker and no bubble when markerPct is null', () => {
    render(<RangeBar layout={{ ...pulseLayout, markerPct: null }} valueLabel="" />);

    expect(screen.queryByTestId('range-marker')).toBeNull();
    expect(screen.queryByTestId('range-bubble')).toBeNull();
  });
});

describe('RangeBar "tu normal" band', () => {
  it('draws the band under the bar at baselinePct, in the baseline token color', () => {
    render(<RangeBar layout={pulseLayout} valueLabel="72 lpm" />);

    const band = screen.getByTestId('range-baseline');
    expect(band).toHaveClass('bg-baseline');
    expect(styleNumber(band, 'left')).toBeCloseTo(pulsePct(62), 5);
    expect(styleNumber(band, 'width')).toBeCloseTo(pulsePct(82) - pulsePct(62), 5);
    expect(screen.queryByText(messages['baseline.learning'])).toBeNull();
  });

  it('hides the band and shows "Aún aprendo tu normal" when the baseline is not ready', () => {
    render(<RangeBar layout={{ ...pulseLayout, baselinePct: null }} valueLabel="72 lpm" baselineLearning />);

    expect(screen.queryByTestId('range-baseline')).toBeNull();
    expect(screen.getByText(messages['baseline.learning'])).toBeInTheDocument();
  });

  it('shows neither the band nor the learning text when there is no baseline and no learning state', () => {
    render(<RangeBar layout={{ ...pulseLayout, baselinePct: null }} valueLabel="72 lpm" />);

    expect(screen.queryByTestId('range-baseline')).toBeNull();
    expect(screen.queryByText(messages['baseline.learning'])).toBeNull();
  });
});

describe('RangeBar allowed label', () => {
  it('shows the allowed range centred under the bar', () => {
    render(<RangeBar layout={tempLayout} valueLabel="36,8 °C" allowedLabel="Permitido 36,1–37,2" />);

    expect(screen.getByTestId('range-allowed')).toHaveTextContent('Permitido 36,1–37,2');
    expect(screen.getByTestId('range-allowed')).toHaveClass('text-center');
  });

  it('shows no cut numbers under the bar: the boundaries are in the allowed range text', () => {
    render(<RangeBar layout={tempLayout} valueLabel="36,8 °C" />);

    expect(screen.queryByTestId('range-cut')).toBeNull();
    expect(screen.queryByTestId('range-allowed')).toBeNull();
  });
});

describe('Legend (D16)', () => {
  it('lists the level labels: allowed, attention, alert and "tu normal"', () => {
    render(<Legend />);

    expect(screen.getByText(messages['legend.allowed'])).toBeInTheDocument();
    expect(screen.getByText(messages['legend.attention'])).toBeInTheDocument();
    expect(screen.getByText(messages['legend.alert'])).toBeInTheDocument();
    expect(screen.getByText(messages['legend.baseline'])).toBeInTheDocument();
  });

  it('shows the team criterion line once, in lowercase (D16)', () => {
    render(<Legend />);

    expect(screen.getByText('* criterio del equipo, no clínico')).toBeInTheDocument();
    expect(screen.getAllByText(/criterio del equipo/)).toHaveLength(1);
  });
});
