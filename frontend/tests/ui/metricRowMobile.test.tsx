/**
 * Mobile (< 768 px) structure of a metric row: name and value on separate lines, the range-bar bubble
 * shows the number only (the unit is `hidden md:inline`), the simulated source is a short chip.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MetricRow } from '../../src/ui/components/MetricRow';
import { computeRangeBar } from '../../src/ui/components/rangeBarLayout';
import { t } from '../../src/config/messages.es';

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MetricRow on mobile', () => {
  it('puts the value on its own line, the bubble without unit, and the source as a short chip', () => {
    const layout = computeRangeBar({
      sensor: 'pulse',
      value: 72,
      baseline: null,
      scale: [40, 140],
    });
    render(
      <MetricRow
        sensor="pulse"
        value="72 lpm"
        level="green"
        source="device"
        simulated
        layout={layout}
        allowedLabel="60–100"
      />,
    );

    const name = screen.getByText(t('sensor.pulse'));
    const valueLine = screen.getByText('72 lpm').closest('p');
    expect(valueLine).not.toBeNull();
    expect(valueLine).toHaveClass('col-span-3', 'row-start-2');
    expect(name.contains(valueLine)).toBe(false);

    const bubble = screen.getByTestId('range-bubble');
    const visible = Array.from(bubble.childNodes)
      .filter((node) => !(node instanceof HTMLElement && node.className.includes('hidden')))
      .map((node) => node.textContent)
      .join('');
    expect(visible).toContain('72');
    expect(visible).not.toContain('lpm');

    const chip = screen.getByTestId('device-chip');
    expect(chip).toHaveClass('block', 'text-[12px]', 'whitespace-nowrap');
    expect(chip.querySelector('.md\\:hidden')?.textContent).toBe(t('device.simulated.short'));

    expect(screen.getByTestId('range-allowed')).toHaveClass('whitespace-nowrap');
  });
});
