/**
 * Tests for the Home status header (T065, FR-016, SC-010). Written before T072; must FAIL
 * until T072 creates the component.
 *
 * Expected API (implemented by T072):
 *
 *   // frontend/src/ui/components/StatusHeader.tsx
 *   StatusHeader({
 *     crewName: string;
 *     verdict: Verdict | 'none';            // 'none' → "Sin chequeo hoy"
 *     mood: { value: number; of: number; level: Level; teamCriterion: true } | null;
 *   })
 *
 * Shows "Estado de {crewName}", the verdict chip "Hoy: {verdict}" styled with the Badge
 * level classes (ok → green, attention → amber, alert → red), and the mood chip
 * "Ánimo {value}/{of}" with the team-criterion mark "*".
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StatusHeader } from '../../src/ui/components/StatusHeader';
import type { StatusHeaderProps } from '../../src/ui/components/StatusHeader';

afterEach(() => {
  cleanup();
});

const MOOD_4: NonNullable<StatusHeaderProps['mood']> = {
  value: 4,
  of: 5,
  level: 'green',
  teamCriterion: true,
};

describe('StatusHeader with a check today', () => {
  it('shows the title "Estado de Ana"', () => {
    render(<StatusHeader crewName="Ana" verdict="attention" mood={MOOD_4} />);

    expect(screen.getByText('Estado de Ana')).toBeInTheDocument();
  });

  it('shows the verdict word "Atención" exactly once in the header (SC-010)', () => {
    render(<StatusHeader crewName="Ana" verdict="attention" mood={MOOD_4} />);

    expect(screen.getByText('Hoy: Atención')).toBeInTheDocument();
    expect(screen.getAllByText(/Atención/)).toHaveLength(1);
  });

  it('shows the mood chip "Ánimo 4/5" carrying the team-criterion mark "*"', () => {
    render(<StatusHeader crewName="Ana" verdict="attention" mood={MOOD_4} />);

    const chip = screen.getByText('Ánimo 4/5');
    expect(chip.textContent).toContain('*');
  });

  it.each([
    ['ok', 'Hoy: Bien', 'text-level-green', 'bg-level-green-bg'],
    ['attention', 'Hoy: Atención', 'text-level-amber', null],
    ['alert', 'Hoy: Alerta', 'text-level-red', null],
  ] as const)(
    'styles the verdict chip for %s with the Badge level classes',
    (verdict, label, textClass, bgClass) => {
      render(<StatusHeader crewName="Ana" verdict={verdict} mood={MOOD_4} />);

      const chip = screen.getByText(label);
      expect(chip).toHaveClass(textClass);
      if (bgClass !== null) {
        expect(chip).toHaveClass(bgClass);
      }
      expect(chip.className).not.toMatch(/primary/);
    },
  );
});

describe('StatusHeader without a check today', () => {
  it('shows "Sin chequeo hoy" and no verdict chip', () => {
    render(<StatusHeader crewName="Ana" verdict="none" mood={null} />);

    expect(screen.getByText('Sin chequeo hoy')).toBeInTheDocument();
    expect(screen.queryByText(/^Hoy:/)).not.toBeInTheDocument();
  });

  it('shows no mood chip', () => {
    render(<StatusHeader crewName="Ana" verdict="none" mood={null} />);

    expect(screen.queryByText(/Ánimo/)).not.toBeInTheDocument();
  });
});
