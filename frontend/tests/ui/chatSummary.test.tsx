/**
 * Tests for the compact summary inside the verdict message: five lines (icon, name, value, badge), no
 * range bars, and a "Ver detalle" toggle that reveals the full metric rows.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CheckRecord } from '@base-vital/contracts';
import { ChatSummary } from '../../src/ui/components/chat/ChatSummary';
import { metricReadingsOf } from '../../src/application/use-cases/metricReadings';
import { METRIC_ORDER } from '../../src/config/constants';
import { t } from '../../src/config/messages.es';
import { ca4Check } from './ca4Check';

afterEach(() => {
  cleanup();
});

function renderSummary(record: CheckRecord = ca4Check()) {
  const readings = metricReadingsOf({
    readings: Object.values(record.readings),
    observations: record.observations,
    previousChecks: [],
  });
  render(<ChatSummary readings={readings} focus={null} />);
  return readings;
}

describe('ChatSummary', () => {
  it('shows one line per sensor in METRIC_ORDER with its name and value, and no range bars', () => {
    const readings = renderSummary();
    const lines = screen.getByTestId('chat-summary').querySelectorAll('li');

    expect(lines).toHaveLength(METRIC_ORDER.length);
    METRIC_ORDER.forEach((sensor, index) => {
      expect(lines[index]).toHaveAttribute('data-sensor', sensor);
      expect(lines[index].textContent).toContain(t(`sensor.${sensor}`));
      const reading = readings.find((item) => item.sensor === sensor);
      expect(lines[index].textContent).toContain(reading?.value ?? '');
    });
    expect(document.querySelector('[data-testid="range-marker"]')).toBeNull();
    expect(document.querySelector('[data-testid="range-bubble"]')).toBeNull();
    expect(document.querySelectorAll('li[data-highlighted]')).toHaveLength(0);
  });

  it('the toggle is collapsed by default, is at least touch size, and reveals the full rows', () => {
    renderSummary();
    const toggle = screen.getByRole('button', { name: t('checkin.details.show') });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('min-h-touch');
    expect(document.querySelectorAll('li[data-highlighted]')).toHaveLength(0);

    fireEvent.click(toggle);
    const hide = screen.getByRole('button', { name: t('checkin.details.hide') });
    expect(hide).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelectorAll('li[data-highlighted]')).toHaveLength(METRIC_ORDER.length);
    expect(document.querySelector('[data-testid="range-marker"]')).not.toBeNull();

    fireEvent.click(hide);
    expect(document.querySelectorAll('li[data-highlighted]')).toHaveLength(0);
  });
});
