/**
 * Tests for the body sensor dot (T073, RN6, Principle VIII, ui-build §3 #3). Written before the
 * component; must FAIL until `src/ui/body3d/SensorDot.tsx` exists.
 *
 * Expected API:
 *
 *   SensorDot({
 *     sensor: SensorKey;               // sleep | pulse | pressure | temperature | oxygen
 *     level: Level | null;             // green | amber | red | in_doubt | unknown; null = not evaluated
 *     reason: Indicator | null;        // the indicator that set the level; null when green
 *     teamCriterion: boolean;          // adds the "*" mark to the label (Principle VIII)
 *     focused: boolean;                // halo class
 *     measuring: boolean;              // spinning-ring class
 *     onSensorTap?: (sensor: SensorKey) => void;   // omitted: non-interactive <span role="img">
 *   })
 *
 * Test hooks (no hex values in ui; colors come from config):
 *   - root `<button>` (or `<span role="img">` without a tap handler): `data-sensor`, `data-level`;
 *     accessible name contains the sensor label
 *   - fill element `[data-testid="sensor-dot-fill"]`: inline background = SENSOR_COLORS[sensor]
 *     (grey LEVEL_COLORS.unknown.fill when level is `unknown`)
 *   - ring element `[data-testid="sensor-dot-ring"]`: only when the level has a ring;
 *     inline border color = LEVEL_COLORS[level].ring; dashed border for `in_doubt`
 *   - halo: element with class `sensor-dot__halo`, only when `focused`
 *   - spinner: element with class `sensor-dot__spinner`, only when `measuring`
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Indicator, Level, SensorKey } from '@base-vital/contracts';
import { SensorDot } from '../../src/ui/body3d/SensorDot';
import { LEVEL_COLORS, SENSOR_COLORS } from '../../src/config/constants';
import { t } from '../../src/config/messages.es';

interface DotProps {
  sensor: SensorKey;
  level: Level | null;
  reason: Indicator | null;
  teamCriterion: boolean;
  focused: boolean;
  measuring: boolean;
  onSensorTap?: (sensor: SensorKey) => void;
}

const BASE: DotProps = {
  sensor: 'sleep',
  level: 'green',
  reason: null,
  teamCriterion: false,
  focused: false,
  measuring: false,
  onSensorTap: () => {},
};

function renderDot(overrides: Partial<DotProps> = {}) {
  const props = { ...BASE, ...overrides };
  return render(<SensorDot {...props} />);
}

afterEach(() => {
  cleanup();
});

describe('SensorDot', () => {
  it('is a button whose accessible name contains the sensor label', () => {
    renderDot({ sensor: 'sleep' });

    expect(screen.getByRole('button', { name: new RegExp(t('sensor.sleep')) })).toBeInTheDocument();
  });

  it('fills the dot with SENSOR_COLORS[sensor]', () => {
    renderDot({ sensor: 'pulse', level: 'green' });

    const fill = screen.getByTestId('sensor-dot-fill');
    expect(fill).toHaveStyle({ backgroundColor: SENSOR_COLORS.pulse });
  });

  it('green: no ring and no status label', () => {
    renderDot({ level: 'green', reason: null });

    expect(screen.queryByTestId('sensor-dot-ring')).toBeNull();
    expect(screen.queryByText(t('level.green'))).toBeNull();
    expect(screen.queryByText(t('level.amber'))).toBeNull();
    expect(screen.queryByText(t('level.red'))).toBeNull();
  });

  it('amber: ring in LEVEL_COLORS.amber and label "Sueño · atención" without mark', () => {
    renderDot({ sensor: 'sleep', level: 'amber', reason: 'sleep_hours', teamCriterion: false });

    const ring = screen.getByTestId('sensor-dot-ring');
    expect(ring).toHaveStyle({ borderColor: LEVEL_COLORS.amber.ring ?? '' });
    expect(screen.getByTestId('sensor-dot-pill-name')).toHaveTextContent('Sueño');
    expect(screen.getByTestId('sensor-dot-pill-level')).toHaveTextContent('atención');
    expect(screen.queryByText(/\*/)).toBeNull();
  });

  it('amber with teamCriterion: label "Ánimo · atención*"', () => {
    renderDot({ sensor: 'sleep', level: 'amber', reason: 'mood', teamCriterion: true });

    expect(screen.getByTestId('sensor-dot-pill-name')).toHaveTextContent('Ánimo');
    expect(screen.getByTestId('sensor-dot-pill-level')).toHaveTextContent('atención*');
  });

  it('red with teamCriterion: label "Pulso · alerta*" and ring in LEVEL_COLORS.red', () => {
    renderDot({ sensor: 'pulse', level: 'red', reason: 'resting_heart_rate', teamCriterion: true });

    const ring = screen.getByTestId('sensor-dot-ring');
    expect(ring).toHaveStyle({ borderColor: LEVEL_COLORS.red.ring ?? '' });
    expect(screen.getByTestId('sensor-dot-pill-name')).toHaveTextContent('Pulso');
    expect(screen.getByTestId('sensor-dot-pill-level')).toHaveTextContent('alerta*');
  });

  it('red without teamCriterion: label "Pulso · alerta" without mark', () => {
    renderDot({ sensor: 'pulse', level: 'red', reason: 'resting_heart_rate', teamCriterion: false });

    expect(screen.getByTestId('sensor-dot-pill-level')).toHaveTextContent('alerta');
    expect(screen.queryByText(/\*/)).toBeNull();
  });

  it('focused: renders the halo class', () => {
    const { container } = renderDot({ focused: true });

    expect(container.querySelector('.sensor-dot__halo')).not.toBeNull();
  });

  it('not focused: no halo class', () => {
    const { container } = renderDot({ focused: false });

    expect(container.querySelector('.sensor-dot__halo')).toBeNull();
  });

  it('measuring: renders the spinning-ring class', () => {
    const { container } = renderDot({ measuring: true });

    expect(container.querySelector('.sensor-dot__spinner')).not.toBeNull();
  });

  it('not measuring: no spinner class', () => {
    const { container } = renderDot({ measuring: false });

    expect(container.querySelector('.sensor-dot__spinner')).toBeNull();
  });

  it('in_doubt: dashed ring and "en duda" label', () => {
    renderDot({ sensor: 'oxygen', level: 'in_doubt', reason: null });

    const ring = screen.getByTestId('sensor-dot-ring');
    expect(ring).toHaveStyle({ borderStyle: 'dashed' });
    expect(ring).toHaveStyle({ borderColor: LEVEL_COLORS.in_doubt.ring ?? '' });
    expect(screen.getByText(t('level.in_doubt'))).toBeInTheDocument();
  });

  it('unknown: grey dot (LEVEL_COLORS.unknown.fill) and "sin dato" label, no ring', () => {
    renderDot({ sensor: 'temperature', level: 'unknown', reason: null });

    const fill = screen.getByTestId('sensor-dot-fill');
    expect(fill).toHaveStyle({ backgroundColor: LEVEL_COLORS.unknown.fill ?? '' });
    expect(screen.queryByTestId('sensor-dot-ring')).toBeNull();
    expect(screen.getByText(t('level.unknown'))).toBeInTheDocument();
  });

  it('click calls onSensorTap with the sensor key', () => {
    const onSensorTap = vi.fn();
    renderDot({ sensor: 'pressure', onSensorTap });

    fireEvent.click(screen.getByRole('button'));

    expect(onSensorTap).toHaveBeenCalledTimes(1);
    expect(onSensorTap).toHaveBeenCalledWith('pressure');
  });

  describe('before evaluation (level null)', () => {
    it('fills the dot with SENSOR_COLORS[sensor], no ring, no status label', () => {
      renderDot({ sensor: 'pulse', level: null, reason: null });

      expect(screen.getByTestId('sensor-dot-fill')).toHaveStyle({ backgroundColor: SENSOR_COLORS.pulse });
      expect(screen.queryByTestId('sensor-dot-ring')).toBeNull();
      expect(screen.queryByTestId('sensor-dot-leader')).toBeNull();
      expect(screen.queryByTestId('sensor-dot-level-marker')).toBeNull();
      expect(screen.queryByText(t('level.unknown'))).toBeNull();
      expect(screen.queryByText(t('level.green'))).toBeNull();
    });

    it('keeps the sensor name as the accessible name and has no data-level', () => {
      renderDot({ sensor: 'pulse', level: null });

      const dot = screen.getByRole('button', { name: t('sensor.pulse') });
      expect(dot).not.toHaveAttribute('data-level');
    });

    it('keeps the 10 px identity size', () => {
      renderDot({ sensor: 'sleep', level: null });

      expect(screen.getByTestId('sensor-dot-fill')).toHaveClass('h-sensorDot', 'w-sensorDot');
    });
  });

  describe('status pill', () => {
    it('is two short lines: the sensor name, then the level; each line is whitespace-nowrap', () => {
      renderDot({ sensor: 'sleep', level: 'amber', reason: 'sleep_hours' });

      const pill = screen.getByTestId('sensor-dot-pill-name').parentElement;
      expect(pill).toHaveClass('border', 'border-line', 'flex-col');
      expect(screen.getByTestId('sensor-dot-pill-name')).toHaveClass('whitespace-nowrap');
      expect(screen.getByTestId('sensor-dot-pill-level')).toHaveClass('whitespace-nowrap');
      expect(screen.getByTestId('sensor-dot-pill-level')).toContainElement(
        screen.getByTestId('sensor-dot-level-marker'),
      );
    });

    it('shows the level as an 8 px marker in the LEVEL_COLORS ring color', () => {
      renderDot({ sensor: 'sleep', level: 'amber', reason: 'sleep_hours' });

      const marker = screen.getByTestId('sensor-dot-level-marker');
      expect(marker).toHaveClass('h-levelMarker', 'w-levelMarker');
      expect(marker).toHaveStyle({ backgroundColor: LEVEL_COLORS.amber.ring ?? '' });
    });

    it('red marker uses the red ring color', () => {
      renderDot({ sensor: 'pulse', level: 'red', reason: 'resting_heart_rate' });

      expect(screen.getByTestId('sensor-dot-level-marker')).toHaveStyle({ backgroundColor: LEVEL_COLORS.red.ring ?? '' });
    });

    it('unknown marker uses the unknown label color (no ring), and the text is ink', () => {
      renderDot({ sensor: 'temperature', level: 'unknown' });

      expect(screen.getByTestId('sensor-dot-level-marker')).toHaveStyle({
        backgroundColor: LEVEL_COLORS.unknown.label,
      });
      expect(screen.getByTestId('sensor-dot-pill-level').parentElement).toHaveClass('text-ink');
    });

    it('amber and red text is neutral ink, not a level color', () => {
      renderDot({ sensor: 'sleep', level: 'amber', reason: 'sleep_hours' });
      const pill = screen.getByTestId('sensor-dot-pill-name').parentElement;
      expect(pill).toHaveClass('text-ink');
      expect(pill).not.toHaveClass('text-level-amber');
    });

    it('leader line uses the neutral line token, not a level color', () => {
      renderDot({ sensor: 'sleep', level: 'amber', reason: 'sleep_hours' });

      expect(screen.getByTestId('sensor-dot-leader')).toHaveClass('bg-line');
    });
  });

  describe('tap target', () => {
    it('the root takes no pointer events; only the 48 px tap target does', () => {
      renderDot({ sensor: 'sleep', level: 'amber', reason: 'sleep_hours' });

      const dot = screen.getByRole('button', { name: new RegExp(t('sensor.sleep')) });
      expect(dot).toHaveClass('pointer-events-none');
      const hit = screen.getByTestId('sensor-dot-hit');
      expect(hit).toHaveClass('pointer-events-auto', 'min-h-touch', 'min-w-touch');
    });

    it('the status pill has no tap target of its own', () => {
      renderDot({ sensor: 'sleep', level: 'amber', reason: 'sleep_hours' });

      expect(screen.getByTestId('sensor-dot-pill-name').parentElement).not.toHaveClass('pointer-events-auto');
      expect(screen.getByTestId('sensor-dot-leader')).not.toHaveClass('pointer-events-auto');
    });

    it('a tap on the tap target calls onSensorTap', () => {
      const onSensorTap = vi.fn();
      renderDot({ sensor: 'oxygen', level: 'amber', reason: 'oxygen_saturation', onSensorTap });

      fireEvent.click(screen.getByTestId('sensor-dot-hit'));

      expect(onSensorTap).toHaveBeenCalledWith('oxygen');
    });
  });

  describe('without onSensorTap', () => {
    it('is a non-interactive image named after the sensor, with no button', () => {
      renderDot({ sensor: 'sleep', level: null, onSensorTap: undefined });

      expect(screen.queryByRole('button')).toBeNull();
      const image = screen.getByRole('img', { name: t('sensor.sleep') });
      expect(image).toHaveAttribute('data-sensor', 'sleep');
      expect(screen.getByTestId('sensor-dot-fill')).toHaveStyle({ backgroundColor: SENSOR_COLORS.sleep });
    });

    it('keeps the status label in the accessible name when evaluated', () => {
      renderDot({ sensor: 'sleep', level: 'amber', reason: 'sleep_hours', onSensorTap: undefined });

      expect(screen.getByRole('img', { name: `${t('sensor.sleep')}, Sueño · atención` })).toBeInTheDocument();
      expect(screen.getByTestId('sensor-dot-pill-name')).toHaveTextContent('Sueño');
    });
  });
});
