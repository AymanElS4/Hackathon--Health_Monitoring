/**
 * Tests for the 2D body fallback (T079, CL5, ui-build §3 #2): the local PNG with one sensor dot per
 * sensor at its `FALLBACK_DOTS` position.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SensorKey } from '@base-vital/contracts';
import { BodyFallback } from '../../src/ui/body3d/BodyFallback';
import { BODY_FALLBACK_URL, FALLBACK_DOTS } from '../../src/config/constants';
import { t } from '../../src/config/messages.es';

afterEach(() => {
  cleanup();
});

describe('BodyFallback', () => {
  it('shows the local body image with its alt text', () => {
    render(<BodyFallback readings={[]} focus={null} evaluated={false} onSensorTap={() => {}} />);
    const image = screen.getByRole('img', { name: t('body.fallbackAlt') });
    expect(image).toHaveAttribute('src', BODY_FALLBACK_URL);
    expect(BODY_FALLBACK_URL).toBe('/models/body-fallback.png');
  });

  it('places one dot per sensor at its FALLBACK_DOTS percentage', () => {
    const { container } = render(<BodyFallback readings={[]} focus={null} evaluated={false} onSensorTap={() => {}} />);
    const anchors = container.querySelectorAll('[data-sensor-anchor]');
    expect(anchors).toHaveLength(SensorKey.options.length);

    for (const sensor of SensorKey.options) {
      const anchor = container.querySelector<HTMLElement>(`[data-sensor-anchor="${sensor}"]`);
      expect(anchor, sensor).not.toBeNull();
      expect(anchor!.style.left).toBe(`${FALLBACK_DOTS[sensor].x}%`);
      expect(anchor!.style.top).toBe(`${FALLBACK_DOTS[sensor].y}%`);
      expect(anchor!.querySelector('button')).toHaveAttribute('data-sensor', sensor);
    }
  });

  it('reports a tap with the sensor key', () => {
    const onSensorTap = vi.fn();
    const { container } = render(<BodyFallback readings={[]} focus={null} evaluated={false} onSensorTap={onSensorTap} />);
    fireEvent.click(container.querySelector('[data-sensor="pulse"]')!);
    expect(onSensorTap).toHaveBeenCalledWith('pulse');
  });

  it('before evaluation: every dot is a plain identity dot (no pill, no ring)', () => {
    const { container } = render(
      <BodyFallback
        readings={[{ sensor: 'pulse', level: 'red', reason: 'resting_heart_rate', teamCriterion: false }]}
        focus={null}
        evaluated={false}
        onSensorTap={() => {}}
      />,
    );
    expect(container.querySelectorAll('[data-level]')).toHaveLength(0);
    expect(screen.queryByText(t('level.unknown'))).toBeNull();
    expect(screen.queryByTestId('sensor-dot-ring')).toBeNull();
  });

  it('evaluated without a pressure reading: pressure shows "sin dato"', () => {
    const readings = SensorKey.options
      .filter((sensor) => sensor !== 'pressure')
      .map((sensor) => ({ sensor, level: 'green' as const, reason: null, teamCriterion: false }));
    const { container } = render(
      <BodyFallback readings={readings} focus={null} evaluated onSensorTap={() => {}} />,
    );
    expect(container.querySelector('button[data-sensor="pressure"]')).toHaveAttribute('data-level', 'unknown');
    expect(screen.getByText(t('level.unknown'))).toBeInTheDocument();
  });

  it('without onSensorTap the dots are non-interactive images', () => {
    render(<BodyFallback readings={[]} focus={null} evaluated={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('img', { name: /Presión|Pulso|Sueño|Temperatura|Oxígeno/ })).toHaveLength(5);
  });
});
