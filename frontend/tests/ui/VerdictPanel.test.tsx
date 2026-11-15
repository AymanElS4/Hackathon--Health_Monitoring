/**
 * Tests for the verdict panel (T071, RF9, RF10, RN5, Principle VIII). Written before the
 * component; must FAIL until `src/ui/components/VerdictPanel.tsx` exists.
 *
 * Expected API:
 *
 *   VerdictPanel({
 *     verdict: Verdict;                          // ok | attention | alert
 *     actionKey: string;                         // '' = no action (verdict ok)
 *     next: { title: string; time: string } | null;
 *   })
 *
 * Shows the verdict label in a Badge styled with its level (ok → green, attention → amber,
 * alert → red), exactly one action and "Lo próximo" (or "no more activities"). It never draws the
 * team-criterion note: the screen renders it once (T080, Principle VIII).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Verdict } from '@base-vital/contracts';
import { VerdictPanel } from '../../src/ui/components/VerdictPanel';
import { messages, t } from '../../src/config/messages.es';

const NEXT = { title: 'Salida extravehicular', time: '10:00' };
const ACTION_KEYS = Object.keys(messages).filter((key) => key.startsWith('action.'));

afterEach(() => {
  cleanup();
});

describe('VerdictPanel', () => {
  it.each<[Verdict, string, string]>([
    ['ok', 'status.verdict.ok', 'text-level-green'],
    ['attention', 'status.verdict.attention', 'text-ink'],
    ['alert', 'status.verdict.alert', 'text-ink'],
  ])('shows the %s label inside a Badge with its level style', (verdict, key, levelClass) => {
    render(<VerdictPanel verdict={verdict} actionKey="" next={NEXT} />);

    const label = screen.getByText(t(key));
    expect(label).toHaveClass(levelClass);
  });

  it('shows exactly one action when the action key is set', () => {
    render(
      <VerdictPanel
        verdict="attention"
        actionKey="action.slept_little"
        next={NEXT}
      />,
    );

    expect(screen.getAllByText(t('action.slept_little'))).toHaveLength(1);
  });

  it('shows no action text when the action key is empty', () => {
    const { container } = render(
      <VerdictPanel verdict="ok" actionKey="" next={NEXT} />,
    );

    for (const key of ACTION_KEYS) {
      expect(container.textContent).not.toContain(t(key));
    }
  });

  it('shows "Lo próximo" with the title and time of the next activity', () => {
    render(<VerdictPanel verdict="ok" actionKey="" next={NEXT} />);

    expect(
      screen.getByText(t('next', { title: NEXT.title, time: NEXT.time })),
    ).toBeInTheDocument();
  });

  it('says there is no next activity when next is null', () => {
    render(<VerdictPanel verdict="ok" actionKey="" next={null} />);

    expect(screen.getByText(t('next.none'))).toBeInTheDocument();
    expect(screen.queryByText(/^Lo próximo/)).not.toBeInTheDocument();
  });

  it('fills the placeholders of the action text from actionParams (missing sensor)', () => {
    render(
      <VerdictPanel
        verdict="attention"
        actionKey="action.missing_data"
        actionParams={{ sensor: 'la presión' }}
        next={NEXT}
      />,
    );

    const text = t('action.missing_data', { sensor: 'la presión' });
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(text).toBe('Falta el dato de la presión: repite la medida');
    expect(text).not.toContain('{');
  });

  it('does not draw the team-criterion note itself; the screen renders it once (T080)', () => {
    render(<VerdictPanel verdict="attention" actionKey="action.single_amber" next={NEXT} />);
    expect(screen.queryByText(messages['team.criterion.note'])).not.toBeInTheDocument();
    expect(screen.queryByText(/criterio del equipo/)).not.toBeInTheDocument();
  });
});
