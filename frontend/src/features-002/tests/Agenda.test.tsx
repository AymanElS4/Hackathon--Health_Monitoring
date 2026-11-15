import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { messages } from '../../src/config/messages.es';
import { Agenda } from '../../src/ui/screens/Agenda';

describe('Agenda', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows today’s schedule with the same upcoming activities as Home', () => {
    render(
      <MemoryRouter initialEntries={['/agenda']}>
        <Agenda />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('link', { name: messages['home.nav.agenda'] })).toHaveLength(2);
    expect(
      screen.getAllByRole('link', { name: messages['home.nav.agenda'] })[0],
    ).toHaveClass('is-active');
    expect(screen.getByText('Mantenimiento de equipos')).toBeInTheDocument();
    expect(screen.getByText('Experimento de biología')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText('13:00')).toBeInTheDocument();
    expect(screen.getAllByText(messages['calendar.onHome'])).toHaveLength(2);
  });

  it('updates the selected date and can return to today', () => {
    render(
      <MemoryRouter initialEntries={['/agenda']}>
        <Agenda />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: messages['calendar.nextMonth'] }));
    expect(screen.getByText(messages['calendar.empty'])).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: messages['calendar.today'] }));
    expect(screen.getByText('Mantenimiento de equipos')).toBeInTheDocument();
    expect(screen.getByText('Experimento de biología')).toBeInTheDocument();
  });
});
