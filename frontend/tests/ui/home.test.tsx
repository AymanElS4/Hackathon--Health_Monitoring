/**
 * Tests for the Home presentational components (T044, FR-014, FR-015, FR-018).
 * Written before T054; must FAIL until T054 creates the components.
 *
 * Props are slices of the Home view model (T053):
 *   HomeHeader({ header: HomeView['header'] })
 *   NowCard({ now: NonNullable<HomeView['now']>; onStart: () => void })
 *   NextList({ next: HomeView['next']; pendingToday: number })
 *   BottomNav({ active: 'home' | 'agenda'; onVita: () => void })
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { HomeView } from '../../src/application/use-cases/buildHomeView';
import { HomeHeader } from '../../src/ui/components/HomeHeader';
import { NowCard } from '../../src/ui/components/NowCard';
import { NextList } from '../../src/ui/components/NextList';
import { BottomNav } from '../../src/ui/components/BottomNav';
import { messages, t } from '../../src/config/messages.es';
import { SOON_TOOLTIP_MS } from '../../src/config/constants';

const AVATAR_URL = '/avatars/crew-placeholder.svg';

const header = (connectivity: 'online' | 'offline'): HomeView['header'] => ({
  crewName: 'Ana',
  missionDay: 23,
  lightPhase: { kind: 'light', day: 9, of: 14 },
  connectivity,
  avatarUrl: AVATAR_URL,
});

const now: NonNullable<HomeView['now']> = {
  itemId: 'daily-checkin',
  time: '09:30',
  titleKey: 'agenda.dailyCheckin',
  durationMin: 1,
  progress: { done: 1, total: 5 },
  action: 'start_checkin',
};

const THREE_NEXT: HomeView['next'] = [
  { id: 'eva', time: '10:00', titleKey: 'agenda.eva', subtitleKey: 'agenda.eva.solarPanel', icon: 'eva' },
  { id: 'bio-experiment', time: '13:00', titleKey: 'agenda.bioExperiment', icon: 'task' },
  { id: 'exercise', time: '18:00', titleKey: 'agenda.exercise', icon: 'exercise' },
];

function renderWithRouter(component: ReactNode) {
  return render(<MemoryRouter>{component}</MemoryRouter>);
}

describe('HomeHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the greeting and the mission day with the light phase', () => {
    render(<HomeHeader header={header('online')} />);

    expect(screen.getByText(t('home.greeting', { name: 'Ana' }))).toBeInTheDocument();
    expect(screen.getByText('Día 23 · Luz 9/14')).toBeInTheDocument();
  });

  it('shows the offline connectivity text when offline', () => {
    render(<HomeHeader header={header('offline')} />);

    expect(screen.getByText(messages['connectivity.offline'])).toBeInTheDocument();
    expect(screen.queryByText(messages['connectivity.online'])).not.toBeInTheDocument();
  });

  it('shows "Conectado" when online', () => {
    render(<HomeHeader header={header('online')} />);

    expect(screen.getByText(messages['connectivity.online'])).toBeInTheDocument();
    expect(screen.queryByText(messages['connectivity.offline'])).not.toBeInTheDocument();
  });

  it('renders the avatar image with its source and alt text', () => {
    render(<HomeHeader header={header('online')} />);

    const avatar = screen.getByRole('img', { name: messages['home.avatarAlt'] });
    expect(avatar).toHaveAttribute('src', AVATAR_URL);
  });
});

describe('NowCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the title, time, duration and progress of the current activity', () => {
    render(<NowCard now={now} onStart={vi.fn()} />);

    expect(screen.getByText(messages['agenda.dailyCheckin'])).toBeInTheDocument();
    expect(screen.getByText('09:30 · 1 min')).toBeInTheDocument();
    expect(screen.getByText(t('home.progress', { done: 1, total: 5 }))).toBeInTheDocument();
    expect(screen.getByText(messages['agenda.dailyCheckin'])).toBeInTheDocument();
  });

  it('calls onStart exactly once when "Empezar" is pressed', () => {
    const onStart = vi.fn();
    render(<NowCard now={now} onStart={onStart} />);

    fireEvent.click(screen.getByRole('button', { name: messages['home.start'] }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('NextList', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows at most 2 upcoming rows even when given 3', () => {
    renderWithRouter(<NextList next={THREE_NEXT} pendingToday={3} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('10:00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('13:00')).toBeInTheDocument();
    expect(screen.queryByText('18:00')).not.toBeInTheDocument();
  });

  it('shows the pending activities count for today', () => {
    renderWithRouter(<NextList next={THREE_NEXT} pendingToday={3} />);

    expect(screen.getByText('3 actividades pendientes hoy')).toBeInTheDocument();
    expect(screen.getByText(t('home.pending', { n: 3 }))).toBeInTheDocument();
  });

  it('says "0 actividades pendientes hoy" when nothing is pending', () => {
    renderWithRouter(<NextList next={[]} pendingToday={0} />);

    expect(screen.getByText('0 actividades pendientes hoy')).toBeInTheDocument();
    expect(screen.queryByText(/actividad pendiente hoy/)).toBeNull();
  });

  it('says "3 actividades pendientes hoy" for three pending activities', () => {
    renderWithRouter(<NextList next={THREE_NEXT} pendingToday={3} />);

    expect(screen.getByText('3 actividades pendientes hoy')).toBeInTheDocument();
  });

  it('uses the singular form when exactly one activity is pending', () => {
    renderWithRouter(<NextList next={THREE_NEXT} pendingToday={1} />);

    expect(screen.getByText('1 actividad pendiente hoy')).toBeInTheDocument();
    expect(screen.queryByText(/actividades pendientes/)).toBeNull();
  });
});

describe('BottomNav', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('marks Hoy as the current page', () => {
    renderWithRouter(<BottomNav active="home" onVita={vi.fn()} />);

    const hoy = screen.getByText(messages['nav.home']).closest('[aria-current]');
    expect(hoy).not.toBeNull();
    expect(hoy).toHaveAttribute('aria-current', 'page');
  });

  it('links Agenda and gives it the same selected color as Hoy', () => {
    const firstRender = renderWithRouter(<BottomNav active="home" onVita={vi.fn()} />);
    const hoy = screen.getByText(messages['nav.home']).closest('[aria-current]');
    const agendaLink = screen.getByRole('link', { name: messages['nav.agenda'] });
    expect(agendaLink).toHaveAttribute('href', '/agenda');
    expect(hoy).toHaveClass('font-semibold', 'text-primary');
    firstRender.unmount();

    renderWithRouter(<BottomNav active="agenda" onVita={vi.fn()} />);
    const agenda = screen.getByText(messages['nav.agenda']).closest('[aria-current]');
    expect(agenda).toHaveAttribute('aria-current', 'page');
    expect(agenda).toHaveClass('font-semibold', 'text-primary');
  });

  it.each(['nav.health', 'nav.guide'])(
    'shows %s as an aria-disabled tab with its name and no visible "Próximamente" at rest',
    (key) => {
      renderWithRouter(<BottomNav active="home" onVita={vi.fn()} />);

      const tab = screen.getByRole('button', { name: new RegExp(messages[key]) });
      expect(tab).toHaveAttribute('aria-disabled', 'true');
      expect(within(tab).queryByText(messages['nav.soon'])).not.toBeInTheDocument();
      expect(screen.queryByText(messages['nav.soon'])).not.toBeInTheDocument();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    },
  );

  it.each(['nav.health', 'nav.guide'])(
    'puts "Próximamente" in the title tooltip of %s',
    (key) => {
      renderWithRouter(<BottomNav active="home" onVita={vi.fn()} />);

      const tab = screen.getByRole('button', { name: new RegExp(messages[key]) });
      expect(tab).toHaveAttribute('title', messages['nav.soon']);
    },
  );

  it('clicking a disabled tab does nothing except showing the tooltip', () => {
    const onVita = vi.fn();
    renderWithRouter(<BottomNav active="home" onVita={onVita} />);

    const tab = screen.getByRole('button', { name: new RegExp(messages['nav.health']) });
    fireEvent.click(tab);

    expect(onVita).not.toHaveBeenCalled();
    expect(tab).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the tooltip on click, links it with aria-describedby, and hides it after the timeout', () => {
    vi.useFakeTimers();
    renderWithRouter(<BottomNav active="home" onVita={vi.fn()} />);

    const tab = screen.getByRole('button', { name: new RegExp(messages['nav.guide']) });
    fireEvent.click(tab);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent(messages['nav.soon']);
    expect(tab).toHaveAttribute('aria-describedby', tooltip.id);

    act(() => {
      vi.advanceTimersByTime(SOON_TOOLTIP_MS);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('calls onVita exactly once when the raised Vita button is pressed', () => {
    const onVita = vi.fn();
    renderWithRouter(<BottomNav active="home" onVita={onVita} />);

    fireEvent.click(screen.getByRole('button', { name: messages['home.vita'] }));

    expect(onVita).toHaveBeenCalledTimes(1);
  });

  it('places the Vita button between the left and right tabs, inside the dock', () => {
    renderWithRouter(<BottomNav active="home" onVita={vi.fn()} />);

    const vita = screen.getByRole('button', { name: messages['home.vita'] });
    expect(vita.closest('nav')).not.toBeNull();
    expect(vita.closest('nav')).toHaveClass('fixed', 'max-w-dock');
  });
});
